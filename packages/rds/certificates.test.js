import { ok, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import afSouth1 from "./certificates/af-south-1.js";
import apEast1 from "./certificates/ap-east-1.js";
import apNortheast1 from "./certificates/ap-northeast-1.js";
import apNortheast2 from "./certificates/ap-northeast-2.js";
import apNortheast3 from "./certificates/ap-northeast-3.js";
import apSouth1 from "./certificates/ap-south-1.js";
import apSouth2 from "./certificates/ap-south-2.js";
import apSoutheast1 from "./certificates/ap-southeast-1.js";
import apSoutheast2 from "./certificates/ap-southeast-2.js";
import apSoutheast3 from "./certificates/ap-southeast-3.js";
import apSoutheast4 from "./certificates/ap-southeast-4.js";
import apSoutheast5 from "./certificates/ap-southeast-5.js";
import apSoutheast7 from "./certificates/ap-southeast-7.js";
import caCentral1 from "./certificates/ca-central-1.js";
import caWest1 from "./certificates/ca-west-1.js";
import euCentral1 from "./certificates/eu-central-1.js";
import euCentral2 from "./certificates/eu-central-2.js";
import euNorth1 from "./certificates/eu-north-1.js";
import euSouth1 from "./certificates/eu-south-1.js";
import euSouth2 from "./certificates/eu-south-2.js";
import euWest1 from "./certificates/eu-west-1.js";
import euWest2 from "./certificates/eu-west-2.js";
import euWest3 from "./certificates/eu-west-3.js";
import globalCert from "./certificates/global.js";
import ilCentral1 from "./certificates/il-central-1.js";
import meCentral1 from "./certificates/me-central-1.js";
import meSouth1 from "./certificates/me-south-1.js";
import mxCentral1 from "./certificates/mx-central-1.js";
import saEast1 from "./certificates/sa-east-1.js";
import usEast1 from "./certificates/us-east-1.js";
import usEast2 from "./certificates/us-east-2.js";
import usGovEast1 from "./certificates/us-gov-east-1.js";
import usGovWest1 from "./certificates/us-gov-west-1.js";
import usWest1 from "./certificates/us-west-1.js";
import usWest2 from "./certificates/us-west-2.js";

const certificates = {
	"af-south-1": afSouth1,
	"ap-east-1": apEast1,
	"ap-northeast-1": apNortheast1,
	"ap-northeast-2": apNortheast2,
	"ap-northeast-3": apNortheast3,
	"ap-south-1": apSouth1,
	"ap-south-2": apSouth2,
	"ap-southeast-1": apSoutheast1,
	"ap-southeast-2": apSoutheast2,
	"ap-southeast-3": apSoutheast3,
	"ap-southeast-4": apSoutheast4,
	"ap-southeast-5": apSoutheast5,
	"ap-southeast-7": apSoutheast7,
	"ca-central-1": caCentral1,
	"ca-west-1": caWest1,
	"eu-central-1": euCentral1,
	"eu-central-2": euCentral2,
	"eu-north-1": euNorth1,
	"eu-south-1": euSouth1,
	"eu-south-2": euSouth2,
	"eu-west-1": euWest1,
	"eu-west-2": euWest2,
	"eu-west-3": euWest3,
	global: globalCert,
	"il-central-1": ilCentral1,
	"me-central-1": meCentral1,
	"me-south-1": meSouth1,
	"mx-central-1": mxCentral1,
	"sa-east-1": saEast1,
	"us-east-1": usEast1,
	"us-east-2": usEast2,
	"us-gov-east-1": usGovEast1,
	"us-gov-west-1": usGovWest1,
	"us-west-1": usWest1,
	"us-west-2": usWest2,
};

for (const [region, cert] of Object.entries(certificates)) {
	test(`certificate ${region} is a non-empty PEM bundle`, () => {
		strictEqual(typeof cert, "string");
		ok(cert.length > 1000, `expected a real PEM, got length ${cert.length}`);
		ok(
			cert.startsWith("-----BEGIN CERTIFICATE-----"),
			"expected a PEM BEGIN marker",
		);
		ok(
			cert.trimEnd().endsWith("-----END CERTIFICATE-----"),
			"expected a PEM END marker",
		);
	});
}
