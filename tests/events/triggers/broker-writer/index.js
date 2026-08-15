// Copyright 2017 - 2026 will Farrell, Luciano Mammino, and Middy contributors.
// SPDX-License-Identifier: MIT
// In-VPC writer for broker-backed event kinds (see SPEC.md).
// Bundled to dist/index.js by `npm run build:broker-writer` (mongodb + kafkajs
// bundled; @aws-sdk/* left external, provided by the nodejs22.x runtime).
// event.action = "docdb" | "kafka"
const { SecretsManager } = require("@aws-sdk/client-secrets-manager");
const { MongoClient } = require("mongodb");
const { Kafka } = require("kafkajs");

const getSecret = async (arn) => {
	const { SecretString } = await new SecretsManager({}).getSecretValue({
		SecretId: arn,
	});
	return JSON.parse(SecretString);
};

const docdb = async () => {
	const { username, password } = await getSecret(process.env.DOCDB_SECRET_ARN);
	const url = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${process.env.DOCDB_ENDPOINT}:27017/?replicaSet=rs0&retryWrites=false`;
	const client = new MongoClient(url, { serverSelectionTimeoutMS: 20000 });
	await client.connect();
	try {
		await client.db("admin").command({
			modifyChangeStreams: 1,
			database: "middy",
			collection: "capture",
			enable: true,
		});
		const coll = client.db("middy").collection("capture");
		const { insertedId } = await coll.insertOne({
			kind: "docdb.insert",
			nested: { key: "value" },
			at: new Date(),
		});
		await coll.updateOne({ _id: insertedId }, { $set: { updated: true } });
		await coll.deleteOne({ _id: insertedId });
		return { ok: true, insertedId };
	} finally {
		await client.close();
	}
};

const kafka = async (event) => {
	const { username, password } = await getSecret(process.env.MSK_SECRET_ARN);
	const client = new Kafka({
		clientId: "middy-events",
		brokers: event.bootstrapBrokers,
		ssl: true,
		sasl: { mechanism: "scram-sha-512", username, password },
	});
	const producer = client.producer();
	await producer.connect();
	try {
		await producer.send({
			topic: event.topic || "middy-capture",
			messages: [
				{
					key: "json",
					value: JSON.stringify({ hello: "kafka", nested: { n: 1 } }),
					headers: { source: "middy-events", "x-num": "1" },
				},
				{ value: "plain text payload" },
				{ value: Buffer.from([0x00, 0x01, 0xfe, 0xff]) },
			],
		});
		return { ok: true };
	} finally {
		await producer.disconnect();
	}
};

exports.handler = async (event) => {
	if (event.action === "docdb") return docdb();
	if (event.action === "kafka") return kafka(event);
	throw new Error(`unknown action: ${event.action}`);
};
