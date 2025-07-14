/*
import compileSchema from 'ajv-cmd/compile'
import transpileFTL from 'ajv-cmd/ftl'

const ajvDefaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: true // needs to be true to allow multi-locale errorMessage to work
}

// This is pulled out due to it's performance cost (50-100ms on cold start)
// Precompile your schema during a build step is recommended.
export const transpileSchema = (schema, ajvOptions) => {
  const options = { ...ajvDefaults, ...ajvOptions }
  return compileSchema(schema, options)
}

export const transpileLocale = transpileFTL
*/

import Ajv from "ajv/dist/2020.js";
import ajvErrors from "ajv-errors";
import ajvFormats from "ajv-formats";
import ajvFormatsDraft2019 from "ajv-formats-draft2019";
import { transpile } from "ajv-ftl-i18n";
import ajvKeywords from "ajv-keywords";

// import transpileFTL from 'ajv-cmd/ftl'
export const transpileFTL = transpile;

// *** Start `ajv-cmd/compile` *** //
// import compileSchema from 'ajv-cmd/compile'

const instance = (options = {}) => {
	Object.assign(options, { keywords: [] });

	const ajv = new Ajv(options);
	ajvFormats(ajv);
	ajvFormatsDraft2019(ajv);
	ajvKeywords(ajv);
	ajvErrors(ajv);
	return ajv;
};

const compileSchema = (schema, options = {}) => {
	Object.assign(options, { keywords: [] });
	const ajv = instance(options);
	return ajv.compile(schema);
};
// *** End `ajv-cmd/compile` *** //

const ajvDefaults = {
	strict: true,
	coerceTypes: "array", // important for query string params
	allErrors: true, // required for ajvErrors
	useDefaults: "empty",
	messages: true, // needs to be true to allow multi-locale errorMessage to work
};

// This is pulled out due to it's performance cost (50-100ms on cold start)
// Precompile your schema during a build step is recommended.
export const transpileSchema = (schema, ajvOptions) => {
	const options = { ...ajvDefaults, ...ajvOptions };
	return compileSchema(schema, options);
};
