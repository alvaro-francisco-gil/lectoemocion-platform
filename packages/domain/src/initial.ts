export function deriveInitial(name: string): string {
  const firstCharacter = Array.from(name.trim())[0];
  if (!firstCharacter) {
    throw new Error("Name must not be empty");
  }

  if (firstCharacter.toLocaleUpperCase("es-ES") === "Ñ") {
    return "Ñ";
  }

  return firstCharacter
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES");
}
