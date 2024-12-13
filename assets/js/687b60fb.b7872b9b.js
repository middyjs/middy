"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[7228],{4129:(e,d,n)=>{n.r(d),n.d(d,{assets:()=>a,contentTitle:()=>i,default:()=>l,frontMatter:()=>o,metadata:()=>r,toc:()=>c});const r=JSON.parse('{"id":"upgrade/0-1","title":"Upgrade 0.x -> 1.x","description":"aka \\"The It\'s Stable Update\\"","source":"@site/docs/upgrade/0-1.md","sourceDirName":"upgrade","slug":"/upgrade/0-1","permalink":"/docs/upgrade/0-1","draft":false,"unlisted":false,"editUrl":"https://github.com/middyjs/middy/tree/main/website/docs/upgrade/0-1.md","tags":[],"version":"current","lastUpdatedAt":1734112351000,"sidebarPosition":10000,"frontMatter":{"title":"Upgrade 0.x -> 1.x","sidebar_position":10000},"sidebar":"tutorialSidebar","previous":{"title":"Upgrade 1.x -> 2.x","permalink":"/docs/upgrade/1-2"},"next":{"title":"AWS Event Examples","permalink":"/docs/category/aws-event-examples"}}');var s=n(4848),t=n(8453);const o={title:"Upgrade 0.x -> 1.x",sidebar_position:1e4},i=void 0,a={},c=[{value:"Independent packages structure",id:"independent-packages-structure",level:2},{value:"Header normalization in <code>http-header-normalizer</code>",id:"header-normalization-in-http-header-normalizer",level:2},{value:"Node.js 10 and 12 now supported / Node.js 6 and 8 now dropped",id:"nodejs-10-and-12-now-supported--nodejs-6-and-8-now-dropped",level:2}];function h(e){const d={a:"a",code:"code",h2:"h2",li:"li",p:"p",ul:"ul",...(0,t.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(d.p,{children:'aka "The It\'s Stable Update"'}),"\n",(0,s.jsx)(d.h2,{id:"independent-packages-structure",children:"Independent packages structure"}),"\n",(0,s.jsxs)(d.p,{children:["Version 1.x of Middy features decoupled independent packages published on npm under the ",(0,s.jsx)(d.code,{children:"@middy"})," namespace. The core middleware engine has been moved to ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/core",children:(0,s.jsx)(d.code,{children:"@middy/core"})})," and all the other middlewares are moved into their own packages as well. This allows to only install the features that are needed and to keep your Lambda dependencies small. See the list below to check which packages you need based on the middlewares you use:"]}),"\n",(0,s.jsxs)(d.ul,{children:["\n",(0,s.jsxs)(d.li,{children:["Core middleware functionality -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/core",children:(0,s.jsx)(d.code,{children:"@middy/core"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"cache"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/cache",children:(0,s.jsx)(d.code,{children:"@middy/cache"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"cors"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-cors",children:(0,s.jsx)(d.code,{children:"@middy/http-cors"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"doNotWaitForEmptyEventLoop"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/do-not-wait-for-empty-event-loop",children:(0,s.jsx)(d.code,{children:"@middy/do-not-wait-for-empty-event-loop"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"httpContentNegotiation"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-content-negotiation",children:(0,s.jsx)(d.code,{children:"@middy/http-content-negotiation"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"httpErrorHandler"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-error-handler",children:(0,s.jsx)(d.code,{children:"@middy/http-error-handler"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"httpEventNormalizer"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-event-normalizer",children:(0,s.jsx)(d.code,{children:"@middy/http-event-normalizer"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"httpHeaderNormalizer"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-header-normalizer",children:(0,s.jsx)(d.code,{children:"@middy/http-header-normalizer"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"httpMultipartBodyParser"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-json-body-parser",children:(0,s.jsx)(d.code,{children:"@middy/http-json-body-parser"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"httpPartialResponse"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-partial-response",children:(0,s.jsx)(d.code,{children:"@middy/http-partial-response"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"jsonBodyParser"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-json-body-parser",children:(0,s.jsx)(d.code,{children:"@middy/http-json-body-parser"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"s3KeyNormalizer"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/s3-key-normalizer",children:(0,s.jsx)(d.code,{children:"@middy/s3-key-normalizer"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"secretsManager"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/secrets-manager",children:(0,s.jsx)(d.code,{children:"@middy/secrets-manager"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"ssm"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/ssm",children:(0,s.jsx)(d.code,{children:"@middy/ssm"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"validator"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/validator",children:(0,s.jsx)(d.code,{children:"@middy/validator"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"urlEncodeBodyParser"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/http-urlencode-body-parser",children:(0,s.jsx)(d.code,{children:"@middy/http-urlencode-body-parser"})})]}),"\n",(0,s.jsxs)(d.li,{children:[(0,s.jsx)(d.code,{children:"warmup"})," -> ",(0,s.jsx)(d.a,{href:"https://www.npmjs.com/package/@middy/warmup",children:(0,s.jsx)(d.code,{children:"@middy/warmup"})})]}),"\n"]}),"\n",(0,s.jsxs)(d.h2,{id:"header-normalization-in-http-header-normalizer",children:["Header normalization in ",(0,s.jsx)(d.code,{children:"http-header-normalizer"})]}),"\n",(0,s.jsxs)(d.p,{children:["In Middy 0.x the ",(0,s.jsx)(d.code,{children:"httpHeaderNormalizer"})," middleware normalizes HTTP header names into their own canonical format, for instance ",(0,s.jsx)(d.code,{children:"Sec-WebSocket-Key"})," (notice the casing). In Middy 1.x this behavior has been changed to provide header names in lowercase format (e.g. ",(0,s.jsx)(d.code,{children:"sec-webSocket-key"}),"). This new behavior is more consistent with what Node.js core ",(0,s.jsx)(d.code,{children:"http"})," package does and what other famous http frameworks like Express or Fastify do, so this is considered a more intuitive approach.\nWhen updating to Middy 1.x, make sure you double check all your references to HTTP headers and switch to the lowercase version to read them.\nAll the middy core modules have been already updated to support the new format, so you should worry only about your userland code."]}),"\n",(0,s.jsx)(d.h2,{id:"nodejs-10-and-12-now-supported--nodejs-6-and-8-now-dropped",children:"Node.js 10 and 12 now supported / Node.js 6 and 8 now dropped"}),"\n",(0,s.jsx)(d.p,{children:"Version 1.x of Middy no longer supports Node.js versions 6.x and 8.x as these versions have been dropped by the AWS Lambda runtime itself and not supported anymore by the Node.js community. You are highly encouraged to move to Node.js 12 or 10, which are the new supported versions in Middy 1.x."})]})}function l(e={}){const{wrapper:d}={...(0,t.R)(),...e.components};return d?(0,s.jsx)(d,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},8453:(e,d,n)=>{n.d(d,{R:()=>o,x:()=>i});var r=n(6540);const s={},t=r.createContext(s);function o(e){const d=r.useContext(t);return r.useMemo((function(){return"function"==typeof e?e(d):{...d,...e}}),[d,e])}function i(e){let d;return d=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),r.createElement(t.Provider,{value:d},e.children)}}}]);