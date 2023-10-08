import { expectType } from 'tsd'
import {
  SanitizeKeyPrefixLeadingNumber,
  SanitizeKeyRemoveDisallowedChar,
  RemoveAllLeadingUnderscore,
  RemoveRepeatedUnderscore,
  SanitizeKey,
  DeepAwaited,
  Choose,
  IsUnknown,
  ArrayValues,
  SanitizeKeys
} from './type-utils'

// SanitizeKeyPrefixLeadingNumber
// adds a leading _ if it starts with a number
expectType<SanitizeKeyPrefixLeadingNumber<'1234'>>('_1234')
expectType<SanitizeKeyPrefixLeadingNumber<'01234'>>('_01234')
// it does not add a leading _ if it starts with something else
expectType<SanitizeKeyPrefixLeadingNumber<'abcd'>>('abcd')
expectType<SanitizeKeyPrefixLeadingNumber<'ABCD'>>('ABCD')
expectType<SanitizeKeyPrefixLeadingNumber<'?abcd'>>('?abcd')
expectType<SanitizeKeyPrefixLeadingNumber<'!abcd'>>('!abcd')
expectType<SanitizeKeyPrefixLeadingNumber<'@abcd'>>('@abcd')
expectType<SanitizeKeyPrefixLeadingNumber<'_abcd'>>('_abcd')
expectType<SanitizeKeyPrefixLeadingNumber<'-abcd'>>('-abcd')

// SanitizeKeyRemoveDisallowedChar
// removes all disallowed chars and replaces them with _
expectType<SanitizeKeyRemoveDisallowedChar<'1234!@#AA$%^&*()BBB_+{}|:"<>?~CC`-=[D]E\\;,./F'>>('1234___AA_______BBB___________CC____D_E_____F')

// RemoveAllLeadingUnderscore
// removes all leading _
expectType<RemoveAllLeadingUnderscore<'_1234'>>('1234')
expectType<RemoveAllLeadingUnderscore<'__1234'>>('1234')
expectType<RemoveAllLeadingUnderscore<'___1234'>>('1234')
// it does not remove _ in the middle or at the end
expectType<RemoveAllLeadingUnderscore<'1234'>>('1234')
expectType<RemoveAllLeadingUnderscore<'12_34'>>('12_34')
expectType<RemoveAllLeadingUnderscore<'1234_'>>('1234_')

// RemoveRepeatedUnderscore
// removes all repeated _
expectType<RemoveRepeatedUnderscore<'__1234'>>('_1234')
expectType<RemoveRepeatedUnderscore<'12__34'>>('12_34')
expectType<RemoveRepeatedUnderscore<'1234__'>>('1234_')
expectType<RemoveRepeatedUnderscore<'12_________________34'>>('12_34')
// does not remove single underscorse or other characters
expectType<RemoveRepeatedUnderscore<'_1234'>>('_1234')
expectType<RemoveRepeatedUnderscore<'1234'>>('1234')

// SanitizeKey
// combines all the above
expectType<SanitizeKey<'api//secret-key0.pem'>>('api_secret_key0_pem')
expectType<SanitizeKey<'0key.0key'>>('_0key_0key')

// SanitizeKeys
// sanitizes all keys in an object
expectType<SanitizeKeys<{ '0key': 0 }>>({ _0key: 0 })
expectType<SanitizeKeys<{ 'api//secret-key0.pem': 0 }>>({ api_secret_key0_pem: 0 })
expectType<SanitizeKeys<{ '0key': 0, 'api//secret-key0.pem': 0 }>>({ _0key: 0, api_secret_key0_pem: 0 })

// DeepAwaited
expectType<DeepAwaited<{ level1: { level2: Promise<Promise<{ innerPromise: Promise<22> }>> } }>>({
  level1: {
    level2: {
      innerPromise: Promise.resolve(22) // Note: getInternal does not recurse into resolved promises
    }
  }
})

// Choose
interface TestChoose {
  boolean: true
  number: 1
  string: 'string'
  array: []
  object: {
    key: 'value'
  }
  promise: Promise<string>
  promiseObject: Promise<{
    key: 'value'
  }>
}
expectType<Choose<TestChoose, 'boolean'>>(true)
expectType<Choose<TestChoose, 'number'>>(1)
expectType<Choose<TestChoose, 'object.key'>>('value')
expectType<Choose<TestChoose, 'promise'>>(Promise.resolve('string'))
expectType<Choose<DeepAwaited<TestChoose>, 'promise'>>('string')
expectType<Choose<TestChoose, 'promiseObject'>>(Promise.resolve({ key: 'value' }))
expectType<Choose<DeepAwaited<TestChoose>, 'promiseObject'>>({ key: 'value' })

// IsUnknown
expectType<IsUnknown<unknown>>(true)
expectType<IsUnknown<any>>(true)
expectType<IsUnknown<never>>(false)
expectType<IsUnknown<undefined>>(false)
expectType<IsUnknown<null>>(false)
expectType<IsUnknown<string>>(false)
expectType<IsUnknown<number>>(false)
expectType<IsUnknown<boolean>>(false)
expectType<IsUnknown<{}>>(false)
expectType<IsUnknown<[]>>(false)
expectType<IsUnknown<{ key: 'value' }>>(false)
expectType<IsUnknown<Promise<string>>>(false)

// ArrayValues
expectType<ArrayValues<['a', 'b', 'c']>>('a')
expectType<ArrayValues<['a', 'b', 'c']>>('b')
expectType<ArrayValues<['a', 'b', 'c']>>('c')
