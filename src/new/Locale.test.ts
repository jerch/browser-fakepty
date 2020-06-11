import { assert } from 'chai';
import { toUpper, toLower } from './Locale';

const CASES = {
  ascii: ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  german: ['äöüß', 'ÄÖÜß'],
  russian: ['абвгдеёжзийклмнопрстуфхцчшщъыьэюя', 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'],
};

describe('locale helper', () => {
  describe('toUpper', () => {
    it('ascii', () => {
      for (let i = 0; i < CASES.ascii[0].length; ++i) {
        assert.equal(toUpper(CASES.ascii[0].charCodeAt(i)), CASES.ascii[1].charCodeAt(i));
      }
    });
    it('german', () => {
      for (let i = 0; i < CASES.german[0].length; ++i) {
        assert.equal(toUpper(CASES.german[0].charCodeAt(i)), CASES.german[1].charCodeAt(i));
      }
    });
    it('russian', () => {
      for (let i = 0; i < CASES.russian[0].length; ++i) {
        assert.equal(toUpper(CASES.russian[0].charCodeAt(i)), CASES.russian[1].charCodeAt(i));
      }
    });
  });
  
  describe('toLower', () => {
    it('ascii', () => {
      for (let i = 0; i < CASES.ascii[0].length; ++i) {
        assert.equal(toLower(CASES.ascii[1].charCodeAt(i)), CASES.ascii[0].charCodeAt(i));
      }
    });
    it('german', () => {
      for (let i = 0; i < CASES.german[0].length; ++i) {
        assert.equal(toLower(CASES.german[1].charCodeAt(i)), CASES.german[0].charCodeAt(i));
      }
    });
    it('russian', () => {
      for (let i = 0; i < CASES.russian[0].length; ++i) {
        assert.equal(toLower(CASES.russian[1].charCodeAt(i)), CASES.russian[0].charCodeAt(i));
      }
    });
  });
});
