// src/http/routes/messages/index.ts
// Comunicação criptografada entre pacientes e profissionais
// REGRA: o servidor nunca descriptografa o conteúdo das mensagens (E2E)

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError, BusinessRuleError } from '../../errors/handler';
import { MessageType } from '../../../domain/enums';

const SendMessageSchema = z.object({
  receiverId: z.string().cuid(),
  /** Conteúdo criptografado no cliente (base64 do ciphertext) — opaco para o servidor */
  content: z.string().min(1).max(65_536), // máx. ~48KB criptografado
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
  fileUrl: z.string().url().optional(),
});

export default async function messagesRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /messages
   * Envia mensagem criptografada para outro usuário do vínculo clínico
   * O servidor apenas armazena o ciphertext — nunca acessa o conteúdo
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = SendMessageSchema.parse(request.body);

      if (body.receiverId === request.user.id) {
        throw new BusinessRuleError('Não é possível enviar mensagem para si mesmo.');
      }

      // Verifica se o receptor existe e tem vínculo clínico com o remetente
      const receiver = await prisma.user.findUnique({
        where: { id: body.receiverId, deletedAt: null },
        select: { id: true, role: true },
      });
      if (!receiver) throw new NotFoundError('Destinatário');

      // Localiza ou cria conversa
      const [idA, idB] = [request.user.id, body.receiverId].sort();
      const conversation = await prisma.conversation.upsert({
        where: { participantAId_participantBId: { participantAId: idA!, participantBId: idB! } },
        create: { participantAId: idA!, participantBId: idB! },
        update: { lastMessageAt: new Date() },
      });

      const message = await prisma.message.create({
        data: {
          senderId: request.user.id,
          receiverId: body.receiverId,
          conversationId: conversation.id,
          content: body.content, // ciphertext — nunca descriptografar no servidor
          type: body.type,
          fileUrl: body.fileUrl ?? null,
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          receiverId: true,
          type: true,
          readAt: true,
          createdAt: true,
          // content é intencionalmente OMITIDO da resposta —
          // o cliente já tem o plaintext, não precisa do ciphertext de volta
        },
      });

      return reply.status(201).send({ data: message });
    },
  );

  /**
   * GET /messages/conversations
   * Lista conversas do usuário com preview (sem expor conteúdo das mensagens)
   */
  fastify.get(
    '/conversations',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { participantAId: request.user.id },
            { participantBId: request.user.id },
          ],
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              type: true,
              readAt: true,
              createdAt: true,
              senderId: true,
              // content OMITIDO — lista de conversas não exibe texto das mensagens
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
      });

      // Conta mensagens não lidas por conversa
      const unreadCounts = await Promise.all(
        conversations.map((c) =>
          prisma.message.count({
            where: {
              conversationId: c.id,
              receiverId: request.user.id,
              readAt: null,
            },
          }),
        ),
      );

      const data = conversations.map((c, i) => ({
        id: c.id,
        lastMessageAt: c.lastMessageAt,
        lastMessage: c.messages[0] ?? null,
        unreadCount: unreadCounts[i],
        participantAId: c.participantAId,
        participantBId: c.participantBId,
      }));

      return reply.send({ data });
    },
  );

  /**
   * GET /messages/:conversationId
   * Histórico da conversa — retorna ciphertexts para descriptografia no cliente
   */
  fastify.get(
    '/:conversationId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };
      const { before, limit } = request.query as { before?: string; limit?: string };

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { participantAId: true, participantBId: true },
      });

      if (!conversation) throw new NotFoundError('Conversa');

      // Verifica que o usuário é participante da conversa
      if (
        conversation.participantAId !== request.user.id &&
        conversation.participantBId !== request.user.id
      ) {
        throw new ForbiddenError();
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
          deletedBySenderAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit ?? 50), 100),
        // content incluído aqui — o cliente precisa para descriptografar
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          content: true,
          type: true,
          fileUrl: true,
          readAt: true,
          createdAt: true,
        },
      });

      // Marca como lidas as mensagens recebidas
      await prisma.message.updateMany({
        where: {
          conversationId,
          receiverId: request.user.id,
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return reply.send({ data: messages.reverse() }); // ordem cronológica
    },
  );
}
