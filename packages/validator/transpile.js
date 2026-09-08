// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
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

import ajvFormatsDraft2019 from "@silverbucket/ajv-formats-draft2019";
import Ajv from "ajv/dist/2020.js";
import ajvErrors from "ajv-errors";
import ajvFormats from "ajv-formats";
import { transpile } from "ajv-ftl-i18n";
import ajvKeywords from "ajv-keywords";

export const transpileFTL = transpile;

// Inlined from `ajv-cmd/compile` to avoid extra dependency

const instance = ({ keywords = [], ...options } = {}) => {
	const ajv = new Ajv(options);
	ajvFormats(ajv);
	ajvFormatsDraft2019(ajv);
	ajvKeywords(ajv);
	ajvErrors(ajv);
	// The plugins above register their keyword sets with `addKeyword`, which
	// throws on a name that is already defined. The caller's `keywords` are
	// held back from the constructor and added last, so a user definition
	// replaces a plugin keyword of the same name instead of colliding with it.
	for (const definition of keywords) {
		for (const name of [definition.keyword ?? definition].flat()) {
			ajv.removeKeyword(name);
		}
		ajv.addKeyword(definition);
	}
	return ajv;
};

const compileSchema = (schema, options = {}) => {
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
