// src/domain/value-objects/symptom-score.vo.test.ts
import { SymptomScore } from './symptom-score.vo';

describe('SymptomScore', () => {
  describe('create()', () => {
    it('deve criar pontuações válidas (0–10)', () => {
      for (let i = 0; i <= 10; i++) {
        const score = SymptomScore.create(i);
        expect(score.value).toBe(i);
      }
    });

    it('deve rejeitar valores negativos', () => {
      expect(() => SymptomScore.create(-1)).toThrow();
    });

    it('deve rejeitar valores acima de 10', () => {
      expect(() => SymptomScore.create(11)).toThrow();
    });

    it('deve rejeitar valores não inteiros', () => {
      expect(() => SymptomScore.create(5.5)).toThrow();
    });
  });

  describe('classificação clínica', () => {
    it('0–3 deve ser classificado como leve', () => {
      [0, 1, 2, 3].forEach((v) => {
        const score = SymptomScore.create(v);
        expect(score.isLow).toBe(true);
        expect(score.isModerate).toBe(false);
        expect(score.isSevere).toBe(false);
      });
    });

    it('4–6 deve ser classificado como moderado', () => {
      [4, 5, 6].forEach((v) => {
        const score = SymptomScore.create(v);
        expect(score.isLow).toBe(false);
        expect(score.isModerate).toBe(true);
        expect(score.isSevere).toBe(false);
      });
    });

    it('7–10 deve ser classificado como severo', () => {
      [7, 8, 9, 10].forEach((v) => {
        const score = SymptomScore.create(v);
        expect(score.isLow).toBe(false);
        expect(score.isModerate).toBe(false);
        expect(score.isSevere).toBe(true);
      });
    });
  });

  describe('equals()', () => {
    it('deve retornar true para pontuações iguais', () => {
      const a = SymptomScore.create(5);
      const b = SymptomScore.create(5);
      expect(a.equals(b)).toBe(true);
    });

    it('deve retornar false para pontuações diferentes', () => {
      const a = SymptomScore.create(3);
      const b = SymptomScore.create(7);
      expect(a.equals(b)).toBe(false);
    });
  });
});
