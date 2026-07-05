/** Round a rand amount to the cent, avoiding float drift at the boundary. */
export function roundToCent(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
