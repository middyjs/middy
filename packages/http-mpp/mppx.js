// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
import { Mppx } from "mppx/server";

export const httpMppVerify = (mppxConfig) => {
	const mppx = Mppx.create(mppxConfig);
	return async (token) => {
		try {
			await mppx.verifyCredential(token);
			return true;
		} catch {
			return false;
		}
	};
};
