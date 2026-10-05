import { z } from 'zod';

function isbn13CheckDigit(first12: string) {
  const sum = [...first12].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

function isValidIsbn10(isbn: string) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, i) => total + (char === 'X' ? 10 : Number(char)) * (10 - i), 0);
  return sum % 11 === 0;
}

const isValidIsbn13 = (isbn: string) => /^97[89]\d{10}$/.test(isbn) && isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];

/**
 * An ISBN-10 or ISBN-13, hyphens and spaces allowed, with a valid check digit.
 * Parses to its ISBN-13, plus the ISBN-10 when it was given as one.
 */
export const isbnSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .refine((isbn) => isValidIsbn10(isbn) || isValidIsbn13(isbn), 'Enter a valid 10 or 13 digit ISBN')
  .transform((isbn) => {
    if (isbn.length === 13) return { isbn13: isbn, isbn10: undefined };
    const first12 = `978${isbn.slice(0, 9)}`;
    return { isbn13: first12 + isbn13CheckDigit(first12), isbn10: isbn };
  });
