// src/domain/value-objects/symptom-score.vo.ts
// Value Object para pontuações de sintomas (escala 0–10)
// Garante invariantes do domínio clínico em tempo de compilação

/** Escala clínica de intensidade de sintoma: 0 (ausente) a 10 (máximo) */
export type SymptomScoreValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export class SymptomScore {
  private readonly _value: SymptomScoreValue;

  private constructor(value: SymptomScoreValue) {
    this._value = value;
  }

  /**
   * Cria um SymptomScore validado.
   * @throws Error se o valor estiver fora do intervalo 0–10
   */
  static create(value: number): SymptomScore {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error(
        `Pontuação de sintoma inválida: ${value}. Deve ser um inteiro entre 0 e 10.`,
      );
    }
    return new SymptomScore(value as SymptomScoreValue);
  }

  get value(): SymptomScoreValue {
    return this._value;
  }

  /** Sintoma leve — pode ser monitorado sem intervenção imediata */
  get isLow(): boolean {
    return this._value <= 3;
  }

  /** Sintoma moderado — requer atenção do profissional */
  get isModerate(): boolean {
    return this._value >= 4 && this._value <= 6;
  }

  /** Sintoma severo — pode indicar necessidade de ajuste de dose ou consulta urgente */
  get isSevere(): boolean {
    return this._value >= 7;
  }

  equals(other: SymptomScore): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this._value}/10`;
  }
}
