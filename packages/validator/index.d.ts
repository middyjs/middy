import type middy from "@middy/core";

interface Options {
	eventSchema?: Function | any;
	contextSchema?: Function | any;
	responseSchema?: Function | any;
	defaultLanguage?: string;
	languages?: object | any;
}

declare function validator(options?: Options): middy.MiddlewareObj;

export default validator;
