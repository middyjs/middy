"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[4740],{217:(e,n,a)=>{a.r(n),a.d(n,{assets:()=>c,contentTitle:()=>o,default:()=>m,frontMatter:()=>i,metadata:()=>d,toc:()=>u});var t=a(5893),r=a(1151),s=a(4866),l=a(5162);const i={title:"validator"},o=void 0,d={id:"middlewares/validator",title:"validator",description:"This middleware automatically validates incoming events and outgoing responses against custom",source:"@site/docs/middlewares/validator.md",sourceDirName:"middlewares",slug:"/middlewares/validator",permalink:"/docs/middlewares/validator",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/middlewares/validator.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",frontMatter:{title:"validator"},sidebar:"tutorialSidebar",previous:{title:"sts",permalink:"/docs/middlewares/sts"},next:{title:"warmup",permalink:"/docs/middlewares/warmup"}},c={},u=[{value:"Install",id:"install",level:2},{value:"Options",id:"options",level:2},{value:"transpileSchema",id:"transpileschema",level:2},{value:"transpileLocale",id:"transpilelocale",level:2},{value:"Sample usage",id:"sample-usage",level:2},{value:"Pre-transpiling example (recommended)",id:"pre-transpiling-example-recommended",level:2},{value:"Transpile during cold-start",id:"transpile-during-cold-start",level:2},{value:"Transpile during cold-start with default messages",id:"transpile-during-cold-start-with-default-messages",level:2}];function h(e){const n={a:"a",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,r.a)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsxs)(n.p,{children:["This middleware automatically validates incoming events and outgoing responses against custom\nschemas defined with the ",(0,t.jsx)(n.a,{href:"http://json-schema.org/",children:"JSON schema syntax"}),"."]}),"\n",(0,t.jsx)(n.p,{children:"Want to use another validator? Try one of the community validators:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:(0,t.jsx)(n.a,{href:"https://www.npmjs.com/package/middy-ajv",children:"ajv"})}),"\n",(0,t.jsx)(n.li,{children:(0,t.jsx)(n.a,{href:"https://www.npmjs.com/package/middy-sparks-joi",children:"middy-sparks-joi"})}),"\n"]}),"\n",(0,t.jsxs)(n.p,{children:["If an incoming event fails validation a ",(0,t.jsx)(n.code,{children:"BadRequest"})," error is raised.\nIf an outgoing response fails validation a ",(0,t.jsx)(n.code,{children:"InternalServerError"})," error is\nraised."]}),"\n",(0,t.jsxs)(n.p,{children:["This middleware can be used in combination with\n",(0,t.jsx)(n.a,{href:"#httperrorhandler",children:(0,t.jsx)(n.code,{children:"httpErrorHandler"})})," to automatically return the right\nresponse to the user."]}),"\n",(0,t.jsxs)(n.p,{children:["It can also be used in combination with ",(0,t.jsx)(n.a,{href:"#httpContentNegotiation",children:(0,t.jsx)(n.code,{children:"http-content-negotiation"})})," to load localized translations for the error messages (based on the currently requested language). This feature uses internally ",(0,t.jsx)(n.a,{href:"http://npm.im/ajv-ftl-i18n",children:(0,t.jsx)(n.code,{children:"ajv-ftl-i18n"})})," module, so reference to this module for options and more advanced use cases. By default the language used will be English (",(0,t.jsx)(n.code,{children:"en"}),"), but you can redefine the default language by passing it in the ",(0,t.jsx)(n.code,{children:"ajvOptions"})," options with the key ",(0,t.jsx)(n.code,{children:"defaultLanguage"})," and specifying as value one of the ",(0,t.jsx)(n.a,{href:"https://www.npmjs.com/package/ajv-i18n#supported-locales",children:"supported locales"}),"."]}),"\n",(0,t.jsxs)(n.p,{children:["Also, this middleware accepts an object with plugins to be applied to customize the internal ",(0,t.jsx)(n.code,{children:"ajv"})," instance."]}),"\n",(0,t.jsx)(n.h2,{id:"install",children:"Install"}),"\n",(0,t.jsx)(n.p,{children:"To install this middleware you can use NPM:"}),"\n",(0,t.jsxs)(s.Z,{groupId:"npm2yarn",children:[(0,t.jsx)(l.Z,{value:"npm",children:(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"npm install --save @middy/validator\nnpm install --save-dev ajv-cmd # Optional: for pre-transpiling\n"})})}),(0,t.jsx)(l.Z,{value:"yarn",label:"Yarn",children:(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"yarn add @middy/validator\nyarn add --dev ajv-cmd # Optional: for pre-transpiling\n"})})}),(0,t.jsx)(l.Z,{value:"pnpm",label:"pnpm",children:(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"pnpm add @middy/validator\npnpm add --save-dev ajv-cmd # Optional: for pre-transpiling\n"})})})]}),"\n",(0,t.jsx)(n.h2,{id:"options",children:"Options"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"eventSchema"})," (function) (default ",(0,t.jsx)(n.code,{children:"undefined"}),"): The compiled ajv validator that will be used\nto validate the input (",(0,t.jsx)(n.code,{children:"request.event"}),") of the Lambda handler."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"contextSchema"})," (function) (default ",(0,t.jsx)(n.code,{children:"undefined"}),"): The compiled ajv validator that will be used\nto validate the input (",(0,t.jsx)(n.code,{children:"request.context"}),") of the Lambda handler. Has additional support for ",(0,t.jsx)(n.code,{children:"typeof"})," keyword to allow validation of ",(0,t.jsx)(n.code,{children:'"typeof":"function"'}),"."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"responseSchema"})," (function) (default ",(0,t.jsx)(n.code,{children:"undefined"}),"): The compiled ajv validator that will be used\nto validate the output (",(0,t.jsx)(n.code,{children:"request.response"}),") of the Lambda handler."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"i18nEnabled"})," (boolean) (default ",(0,t.jsx)(n.code,{children:"true"}),"): Option to disable i18n default package."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"defaultLanguage"})," (string) (default ",(0,t.jsx)(n.code,{children:"en"}),"): When language not found, what language to fallback to."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"languages"})," (object) (default: ",(0,t.jsx)(n.code,{children:"{}"}),"): Localization overrides"]}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:"NOTES:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["At least one of ",(0,t.jsx)(n.code,{children:"eventSchema"})," or ",(0,t.jsx)(n.code,{children:"responseSchema"})," is required."]}),"\n",(0,t.jsxs)(n.li,{children:["If you'd like to have the error details as part of the response, it will need to be handled separately. You can access them from ",(0,t.jsx)(n.code,{children:"request.error.cause.data"}),", the original response can be found at ",(0,t.jsx)(n.code,{children:"request.error.response"}),"."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Important"})," Transpiling schemas & locales on the fly will cause a 50-150ms performance hit during cold start for simple JSON Schemas. Precompiling is highly recommended."]}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"transpileschema",children:"transpileSchema"}),"\n",(0,t.jsxs)(n.p,{children:["Transpile JSON-Schema in to JavaScript. Default ajv plugins used: ",(0,t.jsx)(n.code,{children:"ajv-i18n"}),", ",(0,t.jsx)(n.code,{children:"ajv-formats"}),", ",(0,t.jsx)(n.code,{children:"ajv-formats-draft2019"}),", ",(0,t.jsx)(n.code,{children:"ajv-keywords"}),", ",(0,t.jsx)(n.code,{children:"ajv-errors"}),"."]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"schema"})," (object) (required): JSON-Schema object"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"ajvOptions"})," (object) (default ",(0,t.jsx)(n.code,{children:"undefined"}),"): Options to pass to ",(0,t.jsx)(n.a,{href:"https://ajv.js.org/docs/api.html#options",children:"ajv"}),"\nclass constructor. Defaults are ",(0,t.jsx)(n.code,{children:"{ strict: true, coerceTypes: 'array', allErrors: true, useDefaults: 'empty', messages: true }"}),"."]}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"transpilelocale",children:"transpileLocale"}),"\n",(0,t.jsxs)(n.p,{children:["Transpile Fluent (.ftl) localization file into ajv compatible format. Allows the overriding of the default messages and adds support for multi-language ",(0,t.jsx)(n.code,{children:"errrorMessages"}),"."]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"ftl"})," (string) (required): Contents of an ftl file to be transpiled."]}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"sample-usage",children:"Sample usage"}),"\n",(0,t.jsx)(n.p,{children:"Example for event validation:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport validator from '@middy/validator'\nimport { transpileSchema } from '@middy/validator/transpile'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nconst schema = {\n  type: 'object',\n  required: ['body', 'foo'],\n  properties: {\n    // this will pass validation\n    body: {\n      type: 'string'\n    },\n    // this won't as it won't be in the event\n    foo: {\n      type: 'string'\n    }\n  }\n}\n\nexport const handler = middy()\n  .use(\n    validator({\n      eventSchema: transpileSchema(schema)\n    })\n  )\n  .handler(lambdaHandler)\n\n// invokes the handler, note that property foo is missing\nconst event = {\n  body: JSON.stringify({ something: 'somethingelse' })\n}\nhandler(event, {}, (err, res) => {\n  t.is(err.message, 'Event object failed validation')\n})\n"})}),"\n",(0,t.jsx)(n.p,{children:"Example for response validation:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport validator from '@middy/validator'\nimport { transpileSchema } from '@middy/validator/transpile'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nconst responseSchema = transpileSchema({\n  type: 'object',\n  required: ['body', 'statusCode'],\n  properties: {\n    body: {\n      type: 'object'\n    },\n    statusCode: {\n      type: 'number'\n    }\n  }\n})\n\nexport const handler = middy()\n  .use(validator({ responseSchema }))\n  .handler(lambdaHandler)\n\n//\nhandler({}, {}, (err, response) => {\n  t.not(err, null)\n  t.is(err.message, 'Response object failed validation')\n  expect(response).not.toBe(null)\n  // it doesn't destroy the response so it can be used by other middlewares\n})\n"})}),"\n",(0,t.jsx)(n.p,{children:"Example for body validation:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport httpJsonBodyParser from '@middy/http-json-body-parser'\nimport validator from '@middy/validator'\nimport { transpileSchema } from '@middy/validator/transpile'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nconst eventSchema = {\n  type: 'object',\n  required: ['body'],\n  properties: {\n    body: {\n      type: 'object',\n      required: ['name', 'email'],\n      properties: {\n        name: { type: 'string' },\n        email: { type: 'string', format: 'email' }\n        // schema options https://ajv.js.org/json-schema.html#json-data-type\n      }\n    }\n  }\n}\n\nexport const handler = middy()\n  // to validate the body we need to parse it first\n  .use(httpJsonBodyParser())\n  .use(\n    validator({\n      eventSchema: transpileSchema(eventSchema)\n    })\n  )\n  .handler(lambdaHandler)\n"})}),"\n",(0,t.jsx)(n.h2,{id:"pre-transpiling-example-recommended",children:"Pre-transpiling example (recommended)"}),"\n",(0,t.jsx)(n.p,{children:"Run a build script to before running tests & deployment."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"#!/usr/bin/env bash\n\n# This is an example, should be customize to meet ones needs\n# Powered by `ajv-cmd`\n# $ ajv --help\n\nbundle () {\n  ajv validate ${1} --valid \\\n    --strict true --coerce-types array --all-errors true --use-defaults empty\n  ajv transpile ${1} \\\n  --strict true --coerce-types array --all-errors true --use-defaults empty \\\n  -o ${1%.json}.js\n}\n\nfor file in handlers/*/schema.*.json; do\n  bundle $file\ndone\n\nlocale () {\n  LOCALE=$(basename ${1%.ftl})\n  ajv ftl ${1} --locale ${LOCALE} -o ${1%.ftl}.js\n}\n\nfor file in handlers/*/*.ftl; do\n  locale $file\ndone\n"})}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport validator from '@middy/validator'\nimport eventSchema from './schema.event.js'\nimport en from './en.js'\nimport fr from './fr.js'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nexport const handler = middy()\n  .use(\n    validator({\n      eventSchema,\n      languages: { en, fr }\n    })\n  )\n  .handler(lambdaHandler)\n"})}),"\n",(0,t.jsx)(n.h2,{id:"transpile-during-cold-start",children:"Transpile during cold-start"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-javascript",children:"import { readFile } from 'node:fs/promises'\nimport middy from '@middy/core'\nimport validator from '@middy/validator'\nimport { transpileSchema, transpileLocale } from '@middy/validator/transpile'\nimport eventSchema from './schema.event.json'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nconst en = transpileLocale(await readFile('./en.ftl'))\nconst fr = transpileLocale(await readFile('./fr.ftl'))\n\nexport const handler = middy()\n  .use(\n    validator({\n      eventSchema: transpileSchema(eventSchema),\n      languages: { en, fr }\n    })\n  )\n  .handler(lambdaHandler)\n"})}),"\n",(0,t.jsx)(n.h2,{id:"transpile-during-cold-start-with-default-messages",children:"Transpile during cold-start with default messages"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-javascript",children:"import { readFile } from 'node:fs/promises'\nimport middy from '@middy/core'\nimport validator from '@middy/validator'\nimport { transpileSchema, transpileLocale } from '@middy/validator/transpile'\nimport { en, fr } from 'ajv-ftl-i18n' // `ajv-i18n` can also be used\nimport eventSchema from './schema.event.json'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nexport const handler = middy()\n  .use(\n    validator({\n      eventSchema: transpileSchema(eventSchema),\n      languages: { en, fr }\n    })\n  )\n  .handler(lambdaHandler)\n"})})]})}function m(e={}){const{wrapper:n}={...(0,r.a)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(h,{...e})}):h(e)}},5162:(e,n,a)=>{a.d(n,{Z:()=>l});a(7294);var t=a(6010);const r={tabItem:"tabItem_Ymn6"};var s=a(5893);function l(e){let{children:n,hidden:a,className:l}=e;return(0,s.jsx)("div",{role:"tabpanel",className:(0,t.Z)(r.tabItem,l),hidden:a,children:n})}},4866:(e,n,a)=>{a.d(n,{Z:()=>w});var t=a(7294),r=a(6010),s=a(2466),l=a(6550),i=a(469),o=a(1980),d=a(7392),c=a(12);function u(e){return t.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,t.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:n,children:a}=e;return(0,t.useMemo)((()=>{const e=n??function(e){return u(e).map((e=>{let{props:{value:n,label:a,attributes:t,default:r}}=e;return{value:n,label:a,attributes:t,default:r}}))}(a);return function(e){const n=(0,d.l)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,a])}function m(e){let{value:n,tabValues:a}=e;return a.some((e=>e.value===n))}function p(e){let{queryString:n=!1,groupId:a}=e;const r=(0,l.k6)(),s=function(e){let{queryString:n=!1,groupId:a}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!a)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return a??null}({queryString:n,groupId:a});return[(0,o._X)(s),(0,t.useCallback)((e=>{if(!s)return;const n=new URLSearchParams(r.location.search);n.set(s,e),r.replace({...r.location,search:n.toString()})}),[s,r])]}function f(e){const{defaultValue:n,queryString:a=!1,groupId:r}=e,s=h(e),[l,o]=(0,t.useState)((()=>function(e){let{defaultValue:n,tabValues:a}=e;if(0===a.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!m({value:n,tabValues:a}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${a.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const t=a.find((e=>e.default))??a[0];if(!t)throw new Error("Unexpected error: 0 tabValues");return t.value}({defaultValue:n,tabValues:s}))),[d,u]=p({queryString:a,groupId:r}),[f,v]=function(e){let{groupId:n}=e;const a=function(e){return e?`docusaurus.tab.${e}`:null}(n),[r,s]=(0,c.Nk)(a);return[r,(0,t.useCallback)((e=>{a&&s.set(e)}),[a,s])]}({groupId:r}),j=(()=>{const e=d??f;return m({value:e,tabValues:s})?e:null})();(0,i.Z)((()=>{j&&o(j)}),[j]);return{selectedValue:l,selectValue:(0,t.useCallback)((e=>{if(!m({value:e,tabValues:s}))throw new Error(`Can't select invalid tab value=${e}`);o(e),u(e),v(e)}),[u,v,s]),tabValues:s}}var v=a(2389);const j={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var x=a(5893);function g(e){let{className:n,block:a,selectedValue:t,selectValue:l,tabValues:i}=e;const o=[],{blockElementScrollPositionUntilNextRender:d}=(0,s.o5)(),c=e=>{const n=e.currentTarget,a=o.indexOf(n),r=i[a].value;r!==t&&(d(n),l(r))},u=e=>{let n=null;switch(e.key){case"Enter":c(e);break;case"ArrowRight":{const a=o.indexOf(e.currentTarget)+1;n=o[a]??o[0];break}case"ArrowLeft":{const a=o.indexOf(e.currentTarget)-1;n=o[a]??o[o.length-1];break}}n?.focus()};return(0,x.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,r.Z)("tabs",{"tabs--block":a},n),children:i.map((e=>{let{value:n,label:a,attributes:s}=e;return(0,x.jsx)("li",{role:"tab",tabIndex:t===n?0:-1,"aria-selected":t===n,ref:e=>o.push(e),onKeyDown:u,onClick:c,...s,className:(0,r.Z)("tabs__item",j.tabItem,s?.className,{"tabs__item--active":t===n}),children:a??n},n)}))})}function b(e){let{lazy:n,children:a,selectedValue:r}=e;const s=(Array.isArray(a)?a:[a]).filter(Boolean);if(n){const e=s.find((e=>e.props.value===r));return e?(0,t.cloneElement)(e,{className:"margin-top--md"}):null}return(0,x.jsx)("div",{className:"margin-top--md",children:s.map(((e,n)=>(0,t.cloneElement)(e,{key:n,hidden:e.props.value!==r})))})}function y(e){const n=f(e);return(0,x.jsxs)("div",{className:(0,r.Z)("tabs-container",j.tabList),children:[(0,x.jsx)(g,{...e,...n}),(0,x.jsx)(b,{...e,...n})]})}function w(e){const n=(0,v.Z)();return(0,x.jsx)(y,{...e,children:u(e.children)},String(n))}},1151:(e,n,a)=>{a.d(n,{Z:()=>i,a:()=>l});var t=a(7294);const r={},s=t.createContext(r);function l(e){const n=t.useContext(s);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),t.createElement(s.Provider,{value:n},e.children)}}}]);