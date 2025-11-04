import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePublicId(length = 5) {
  let result = "";

  for (let i = 0; i < length; i += 1) {
    const randomIndex = randomInt(0, ALPHABET.length);
    result += ALPHABET[randomIndex];
  }

  return result;
}
