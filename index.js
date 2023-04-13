// const AggregateError = require("aggregate-error");
// const tempy = require("tempy");
// const setLegacyToken = require("@semantic-release/npm/lib/set-legacy-token");
// const getPkg = require("@semantic-release/npm/lib/get-pkg");
// const verifyNpmConfig = require("@semantic-release/npm/lib/verify-config");
// const verifyNpmAuth = require("./lib/verify-auth").default;
// const verifyGit = require("./lib/verify-git").default;
// const prepareNpm = require("./lib/prepare").default;
// const publishNpm = require("./lib/publish").default;

import AggregateError from "aggregate-error";
import tempy from "tempy";
import getPkg from "@semantic-release/npm/lib/get-pkg";
import verifyNpmConfig from "@semantic-release/npm/lib/verify-config";
import verifyNpmAuth from "./lib/verify-auth";
import verifyGit from "./lib/verify-git";
import prepareNpm from "./lib/prepare";
import publishNpm from "./lib/publish";
import generateNotes from "./lib/generate-notes";

// export const generateNotes = require("./lib/generate-notes").default;

let verified;
const npmrc = tempy.file({ name: ".npmrc" });

const defaultConfig = {
	npmVerifyAuth: true,
	npmPublish: undefined,
	tarballDir: undefined,
	pkgRoot: undefined,
	latch: "minor",
};

/**
 * @template T
 * @param {T} value
 * @param {T} defaultValue
 * @returns {T}
 */
function defaultTo(value, defaultValue) {
	return value === null || value === undefined ? defaultValue : value;
}

export async function verifyConditions(pluginConfig, context) {
	pluginConfig.npmVerifyAuth = defaultTo(pluginConfig.npmVerifyAuth, defaultConfig.npmVerifyAuth);
	pluginConfig.npmPublish = defaultTo(pluginConfig.npmPublish, defaultConfig.npmPublish);
	pluginConfig.tarballDir = defaultTo(pluginConfig.tarballDir, defaultConfig.tarballDir);
	pluginConfig.pkgRoot = defaultTo(pluginConfig.pkgRoot, defaultConfig.pkgRoot);

	const errors = [...verifyNpmConfig(pluginConfig), ...(await verifyGit(context))];

	setLegacyToken(context);

	try {
		if (pluginConfig.npmVerifyAuth) {
			const pkg = await getPkg(pluginConfig, context);
			await verifyNpmAuth(npmrc, pkg, context);
		}
	} catch (error) {
		errors.push(...error);
	}

	if (errors.length > 0) {
		throw new AggregateError(errors);
	}

	verified = true;
}

export async function prepare(pluginConfig, context) {
	pluginConfig.latch = defaultTo(pluginConfig.latch, defaultConfig.latch);

	const errors = verified ? [] : verifyNpmConfig(pluginConfig);

	setLegacyToken(context);

	try {
		if (pluginConfig.npmVerifyAuth) {
			const pkg = await getPkg(pluginConfig, context);
			await verifyNpmAuth(npmrc, pkg, context);
		}
	} catch (error) {
		errors.push(...error);
	}

	if (errors.length > 0) {
		throw new AggregateError(errors);
	}

	await prepareNpm(npmrc, pluginConfig, context);
}

export async function publish(pluginConfig, context) {
	let pkg;
	const errors = verified ? [] : verifyNpmConfig(pluginConfig);

	setLegacyToken(context);

	try {
		// Reload package.json in case a previous external step updated it
		pkg = await getPkg(pluginConfig, context);
		if (!verified && pluginConfig.npmPublish !== false && pkg.private !== true) {
			await verifyNpmAuth(npmrc, pkg, context);
		}
	} catch (error) {
		errors.push(...error);
	}

	if (errors.length > 0) {
		throw new AggregateError(errors);
	}

	return publishNpm(npmrc, pluginConfig, pkg, context);
}

// module.exports = {
// 	verifyConditions,
// 	prepare,
// 	publish,
// 	generateNotes,
// };
