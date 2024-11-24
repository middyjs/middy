"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[1338],{7803:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>u,contentTitle:()=>d,default:()=>p,frontMatter:()=>l,metadata:()=>i,toc:()=>c});var r=n(5893),a=n(1151),s=n(4866),o=n(5162);const l={title:"http-router"},d=void 0,i={id:"routers/http-router",title:"http-router",description:"This handler can route to requests to one of a nested handler based on method and path of an http event from API Gateway (REST or HTTP) or Elastic Load Balancer.",source:"@site/docs/routers/http-router.md",sourceDirName:"routers",slug:"/routers/http-router",permalink:"/docs/routers/http-router",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/routers/http-router.md",tags:[],version:"current",lastUpdatedAt:1732409762,formattedLastUpdatedAt:"Nov 24, 2024",frontMatter:{title:"http-router"},sidebar:"tutorialSidebar",previous:{title:"Routers",permalink:"/docs/category/routers"},next:{title:"ws-router",permalink:"/docs/routers/ws-router"}},u={},c=[{value:"Install",id:"install",level:2},{value:"Options",id:"options",level:2},{value:"Sample usage",id:"sample-usage",level:2},{value:"Sample kebab usage",id:"sample-kebab-usage",level:2}];function h(e){const t={code:"code",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,a.a)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsxs)(t.p,{children:["This handler can route to requests to one of a nested handler based on ",(0,r.jsx)(t.code,{children:"method"})," and ",(0,r.jsx)(t.code,{children:"path"})," of an http event from API Gateway (REST or HTTP) or Elastic Load Balancer."]}),"\n",(0,r.jsx)(t.h2,{id:"install",children:"Install"}),"\n",(0,r.jsx)(t.p,{children:"To install this middleware you can use NPM:"}),"\n",(0,r.jsxs)(s.Z,{groupId:"npm2yarn",children:[(0,r.jsx)(o.Z,{value:"npm",children:(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-bash",children:"npm install --save @middy/http-router\n"})})}),(0,r.jsx)(o.Z,{value:"yarn",label:"Yarn",children:(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-bash",children:"yarn add @middy/http-router\n"})})}),(0,r.jsx)(o.Z,{value:"pnpm",label:"pnpm",children:(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-bash",children:"pnpm add @middy/http-router\n"})})})]}),"\n",(0,r.jsx)(t.h2,{id:"options",children:"Options"}),"\n",(0,r.jsxs)(t.ul,{children:["\n",(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.code,{children:"routes"})," (array[{method, path, handler}]) (required): Array of route objects.","\n",(0,r.jsxs)(t.ul,{children:["\n",(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.code,{children:"method"})," (string) (required): One of ",(0,r.jsx)(t.code,{children:"GET"}),", ",(0,r.jsx)(t.code,{children:"POST"}),", ",(0,r.jsx)(t.code,{children:"PUT"}),", ",(0,r.jsx)(t.code,{children:"PATCH"}),", ",(0,r.jsx)(t.code,{children:"DELETE"}),", ",(0,r.jsx)(t.code,{children:"OPTIONS"})," and ",(0,r.jsx)(t.code,{children:"ANY"})," that will match to any method passed in"]}),"\n",(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.code,{children:"path"})," (string) (required): AWS formatted path starting with ",(0,r.jsx)(t.code,{children:"/"}),". Variable: ",(0,r.jsx)(t.code,{children:"/{id}/"}),", Wildcard: ",(0,r.jsx)(t.code,{children:"/{proxy+}"})]}),"\n",(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.code,{children:"handler"})," (function) (required): Any ",(0,r.jsx)(t.code,{children:"handler(event, context)"})," function"]}),"\n"]}),"\n"]}),"\n",(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.code,{children:"notFoundResponse"})," (function): Override default 404 error thrown with your own custom response. Passes in ",(0,r.jsx)(t.code,{children:"{method, path}"})]}),"\n"]}),"\n",(0,r.jsx)(t.p,{children:"NOTES:"}),"\n",(0,r.jsxs)(t.ul,{children:["\n",(0,r.jsxs)(t.li,{children:["When using API Gateway it may be required to prefix ",(0,r.jsx)(t.code,{children:"routes[].path"})," with ",(0,r.jsx)(t.code,{children:"/{stage}"})," depending on your use case."]}),"\n",(0,r.jsxs)(t.li,{children:["Errors should be handled as part of the router middleware stack ",(0,r.jsx)(t.strong,{children:"or"})," the lambdaHandler middleware stack. Handled errors in the later will trigger the ",(0,r.jsx)(t.code,{children:"after"})," middleware stack of the former."]}),"\n",(0,r.jsx)(t.li,{children:"Shared middlewares, connected to the router middleware stack, can only be run before the lambdaHandler middleware stack."}),"\n",(0,r.jsxs)(t.li,{children:[(0,r.jsx)(t.code,{children:"pathParameters"})," will automatically be set if not already set"]}),"\n",(0,r.jsxs)(t.li,{children:["Path parameters in kebab notation (",(0,r.jsx)(t.code,{children:"{my-var}"}),") are not supported. Workaround example below."]}),"\n"]}),"\n",(0,r.jsx)(t.h2,{id:"sample-usage",children:"Sample usage"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport httpRouterHandler from '@middy/http-router'\nimport validatorMiddleware from '@middy/validator'\n\nconst getHandler = middy()\n  .use(validatorMiddleware({eventSchema: {...} }))\n  .handler((event, context) => {\n    return {\n      statusCode: 200,\n      body: '{...}'\n    }\n  })\n\nconst postHandler = middy()\n  .use(validatorMiddleware({eventSchema: {...} }))\n  .handler((event, context) => {\n    return {\n      statusCode: 200,\n      body: '{...}'\n    }\n  })\n\nconst routes = [\n  {\n    method: 'GET',\n    path: '/user/{id}',\n    handler: getHandler\n  },\n  {\n    method: 'POST',\n    path: '/user',\n    handler: postHandler\n  }\n]\n\nexport const handler = middy()\n  .use(httpHeaderNormalizer())\n  .handler(httpRouterHandler(routes))\n\n"})}),"\n",(0,r.jsx)(t.h2,{id:"sample-kebab-usage",children:"Sample kebab usage"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport httpRouterHandler from '@middy/http-router'\nimport validatorMiddleware from '@middy/validator'\nimport { kebab } from 'change-case'\n\nconst getHandler = middy()\n  .before((request) => {\n    const key = 'myId'\n    request.event.pathParameters[kebab(key)] = request.event.pathParameters[key]\n    delete request.event.pathParameters[key]\n  })\n  .use(validatorMiddleware({eventSchema: {...} }))\n  .handler((event, context) => {\n    return {\n      statusCode: 200,\n      body: '{...}'\n    }\n  })\n\nconst postHandler = middy()\n  .use(validatorMiddleware({eventSchema: {...} }))\n  .handler((event, context) => {\n    return {\n      statusCode: 200,\n      body: '{...}'\n    }\n  })\n\nconst routes = [\n  {\n    method: 'GET',\n    path: '/user/{myId}', // '/user/{my-id}' update to lowerCamelCase\n    handler: getHandler\n  },\n  {\n    method: 'POST',\n    path: '/user',\n    handler: postHandler\n  }\n]\n\nexport const handler = middy()\n  .use(httpHeaderNormalizer())\n  .handler(httpRouterHandler(routes))\n\n"})})]})}function p(e={}){const{wrapper:t}={...(0,a.a)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(h,{...e})}):h(e)}},5162:(e,t,n)=>{n.d(t,{Z:()=>o});n(7294);var r=n(6010);const a={tabItem:"tabItem_Ymn6"};var s=n(5893);function o(e){let{children:t,hidden:n,className:o}=e;return(0,s.jsx)("div",{role:"tabpanel",className:(0,r.Z)(a.tabItem,o),hidden:n,children:t})}},4866:(e,t,n)=>{n.d(t,{Z:()=>w});var r=n(7294),a=n(6010),s=n(2466),o=n(6550),l=n(469),d=n(1980),i=n(7392),u=n(12);function c(e){return r.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,r.isValidElement)(e)&&function(e){const{props:t}=e;return!!t&&"object"==typeof t&&"value"in t}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:t,children:n}=e;return(0,r.useMemo)((()=>{const e=t??function(e){return c(e).map((e=>{let{props:{value:t,label:n,attributes:r,default:a}}=e;return{value:t,label:n,attributes:r,default:a}}))}(n);return function(e){const t=(0,i.l)(e,((e,t)=>e.value===t.value));if(t.length>0)throw new Error(`Docusaurus error: Duplicate values "${t.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[t,n])}function p(e){let{value:t,tabValues:n}=e;return n.some((e=>e.value===t))}function m(e){let{queryString:t=!1,groupId:n}=e;const a=(0,o.k6)(),s=function(e){let{queryString:t=!1,groupId:n}=e;if("string"==typeof t)return t;if(!1===t)return null;if(!0===t&&!n)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return n??null}({queryString:t,groupId:n});return[(0,d._X)(s),(0,r.useCallback)((e=>{if(!s)return;const t=new URLSearchParams(a.location.search);t.set(s,e),a.replace({...a.location,search:t.toString()})}),[s,a])]}function b(e){const{defaultValue:t,queryString:n=!1,groupId:a}=e,s=h(e),[o,d]=(0,r.useState)((()=>function(e){let{defaultValue:t,tabValues:n}=e;if(0===n.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(t){if(!p({value:t,tabValues:n}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${t}" but none of its children has the corresponding value. Available values are: ${n.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return t}const r=n.find((e=>e.default))??n[0];if(!r)throw new Error("Unexpected error: 0 tabValues");return r.value}({defaultValue:t,tabValues:s}))),[i,c]=m({queryString:n,groupId:a}),[b,f]=function(e){let{groupId:t}=e;const n=function(e){return e?`docusaurus.tab.${e}`:null}(t),[a,s]=(0,u.Nk)(n);return[a,(0,r.useCallback)((e=>{n&&s.set(e)}),[n,s])]}({groupId:a}),x=(()=>{const e=i??b;return p({value:e,tabValues:s})?e:null})();(0,l.Z)((()=>{x&&d(x)}),[x]);return{selectedValue:o,selectValue:(0,r.useCallback)((e=>{if(!p({value:e,tabValues:s}))throw new Error(`Can't select invalid tab value=${e}`);d(e),c(e),f(e)}),[c,f,s]),tabValues:s}}var f=n(2389);const x={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var v=n(5893);function y(e){let{className:t,block:n,selectedValue:r,selectValue:o,tabValues:l}=e;const d=[],{blockElementScrollPositionUntilNextRender:i}=(0,s.o5)(),u=e=>{const t=e.currentTarget,n=d.indexOf(t),a=l[n].value;a!==r&&(i(t),o(a))},c=e=>{let t=null;switch(e.key){case"Enter":u(e);break;case"ArrowRight":{const n=d.indexOf(e.currentTarget)+1;t=d[n]??d[0];break}case"ArrowLeft":{const n=d.indexOf(e.currentTarget)-1;t=d[n]??d[d.length-1];break}}t?.focus()};return(0,v.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,a.Z)("tabs",{"tabs--block":n},t),children:l.map((e=>{let{value:t,label:n,attributes:s}=e;return(0,v.jsx)("li",{role:"tab",tabIndex:r===t?0:-1,"aria-selected":r===t,ref:e=>d.push(e),onKeyDown:c,onClick:u,...s,className:(0,a.Z)("tabs__item",x.tabItem,s?.className,{"tabs__item--active":r===t}),children:n??t},t)}))})}function j(e){let{lazy:t,children:n,selectedValue:a}=e;const s=(Array.isArray(n)?n:[n]).filter(Boolean);if(t){const e=s.find((e=>e.props.value===a));return e?(0,r.cloneElement)(e,{className:"margin-top--md"}):null}return(0,v.jsx)("div",{className:"margin-top--md",children:s.map(((e,t)=>(0,r.cloneElement)(e,{key:t,hidden:e.props.value!==a})))})}function g(e){const t=b(e);return(0,v.jsxs)("div",{className:(0,a.Z)("tabs-container",x.tabList),children:[(0,v.jsx)(y,{...e,...t}),(0,v.jsx)(j,{...e,...t})]})}function w(e){const t=(0,f.Z)();return(0,v.jsx)(g,{...e,children:c(e.children)},String(t))}},1151:(e,t,n)=>{n.d(t,{Z:()=>l,a:()=>o});var r=n(7294);const a={},s=r.createContext(a);function o(e){const t=r.useContext(s);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function l(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:o(e.components),r.createElement(s.Provider,{value:t},e.children)}}}]);