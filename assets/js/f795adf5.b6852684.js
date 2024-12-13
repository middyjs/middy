"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[4384],{9423:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>i,default:()=>h,frontMatter:()=>a,metadata:()=>r,toc:()=>d});const r=JSON.parse('{"id":"intro/early-interrupt","title":"Early Response","description":"Some middlewares might need to stop the whole execution flow and return a response immediately.","source":"@site/docs/intro/04-early-interrupt.md","sourceDirName":"intro","slug":"/intro/early-interrupt","permalink":"/docs/intro/early-interrupt","draft":false,"unlisted":false,"editUrl":"https://github.com/middyjs/middy/tree/main/website/docs/intro/04-early-interrupt.md","tags":[],"version":"current","lastUpdatedAt":1734112351000,"sidebarPosition":4,"frontMatter":{"title":"Early Response","position":4},"sidebar":"tutorialSidebar","previous":{"title":"How it works","permalink":"/docs/intro/how-it-works"},"next":{"title":"Handling Errors","permalink":"/docs/intro/handling-errors"}}');var o=t(4848),s=t(8453);const a={title:"Early Response",position:4},i=void 0,c={},d=[];function l(e){const n={code:"code",p:"p",pre:"pre",strong:"strong",...(0,s.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.p,{children:"Some middlewares might need to stop the whole execution flow and return a response immediately."}),"\n",(0,o.jsxs)(n.p,{children:[(0,o.jsx)(n.strong,{children:"Note"}),": this will totally stop the execution of successive middlewares in any phase (",(0,o.jsx)(n.code,{children:"before"}),", ",(0,o.jsx)(n.code,{children:"after"}),", ",(0,o.jsx)(n.code,{children:"onError"}),") and returns\nan early response (or an error) directly at the Lambda level. If your middlewares do a specific task on every request\nlike output serialization, error handling or clean, these won't be invoked in this case. They will have to be handled before the return."]}),"\n",(0,o.jsx)(n.p,{children:"In this example, we can use this capability for building a sample caching middleware:"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{className:"language-javascript",children:"// some function that calculates the cache id based on the current event\nconst calculateCacheId = (event) => {\n  /* ... */\n}\nconst storage = {}\n\n// middleware\nconst cacheMiddleware = (options) => {\n  let cacheKey\n\n  const cacheMiddlewareBefore = async (request) => {\n    cacheKey = options.calculateCacheId(request.event)\n    if (options.storage.hasOwnProperty(cacheKey)) {\n\n      // if the value can be `undefined` use this line\n      request.earlyResponse = options.storage[cacheKey]\n\n      // exits early and returns the value from the cache if it's already there\n      return options.storage[cacheKey]\n    }\n  }\n\n  const cacheMiddlewareAfter = async (request) => {\n    // stores the calculated response in the cache\n    options.storage[cacheKey] = request.response\n  }\n\n  const cacheMiddlewareOnError = async (request) => {\n    // Note: onError cannot earlyResonse with undefined\n  }\n\n  return {\n    before: cacheMiddlewareBefore,\n    after: cacheMiddlewareAfter\n  }\n}\n\n// sample usage\nconst lambdaHandler = (event, context) => {\n  /* ... */\n}\nexport const handler = middy()\n  .use(\n    cacheMiddleware({\n      calculateCacheId,\n      storage\n    })\n  )\n  .handler(lambdaHandler)\n"})})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>a,x:()=>i});var r=t(6540);const o={},s=r.createContext(o);function a(e){const n=r.useContext(s);return r.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:a(e.components),r.createElement(s.Provider,{value:n},e.children)}}}]);