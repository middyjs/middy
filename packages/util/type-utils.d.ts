type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type LetterLower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i'
| 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't'
| 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
type LetterUpper = Uppercase<LetterLower>
type AlphaNumeric = Digit | LetterLower | LetterUpper

export type SanitizeKeyPrefixLeadingNumber<T> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  T extends `${infer _ extends Digit}${any}`
    ? `_${T}`
    : T

type SanitizeKeyRemoveDisallowedChar<T> =
  T extends `${infer First}${infer Rest}`
    ? First extends AlphaNumeric
      ? `${First}${SanitizeKeyRemoveDisallowedChar<Rest>}`
      : `_${SanitizeKeyRemoveDisallowedChar<Rest>}`
    : T extends ''
      ? T
      : never

type RemoveAllLeadingUnderscore<T> =
  T extends `_${infer Rest}`
    ? RemoveAllLeadingUnderscore<Rest>
    : T extends string
      ? T
      : never

type RemoveRepeatedUnderscore<T> =
  T extends `${infer First}_${infer Rest}`
    ? `${First}_${RemoveRepeatedUnderscore<RemoveAllLeadingUnderscore<Rest>>}`
    : T extends string
      ? T
      : never

type SanitizeKey<T> =
  RemoveRepeatedUnderscore<
  SanitizeKeyRemoveDisallowedChar<
  SanitizeKeyPrefixLeadingNumber<T>
  >
  >

type SanitizeKeys<T extends Record<string, unknown>> = {
  [P in keyof T as SanitizeKey<P>]: T[P]
}

type DeepAwaited<T> =
T extends Promise<infer R>
  ? Awaited<R>
  : {
      [P in keyof T]:
      T[P] extends Promise<infer R>
        ? Awaited<R> // if it's a Promise resolve
        : DeepAwaited<T[P]>
    }

export type Choose<
  T extends Record<string | number, any>,
  K extends string
> = K extends `${infer U}.${infer Rest}` ? Choose<T[U], Rest> : T[K]

export type IsUnknown<T> = unknown extends T ? true : false

export type ArrayValues<T> = T extends Array<infer U> ? U : never
