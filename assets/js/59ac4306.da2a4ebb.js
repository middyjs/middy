"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[3151],{487:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>u,contentTitle:()=>i,default:()=>h,frontMatter:()=>o,metadata:()=>d,toc:()=>c});var n=r(5893),a=r(1151),l=r(4866),s=r(5162);const o={title:"http-urlencode-body-parser"},i=void 0,d={id:"middlewares/http-urlencode-body-parser",title:"http-urlencode-body-parser",description:"This middleware automatically parses HTTP requests with URL-encoded body (typically the result",source:"@site/docs/middlewares/http-urlencode-body-parser.md",sourceDirName:"middlewares",slug:"/middlewares/http-urlencode-body-parser",permalink:"/docs/middlewares/http-urlencode-body-parser",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/middlewares/http-urlencode-body-parser.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",frontMatter:{title:"http-urlencode-body-parser"},sidebar:"tutorialSidebar",previous:{title:"http-security-headers",permalink:"/docs/middlewares/http-security-headers"},next:{title:"http-urlencode-path-parser",permalink:"/docs/middlewares/http-urlencode-path-parser"}},u={},c=[{value:"Install",id:"install",level:2},{value:"Options",id:"options",level:2},{value:"Sample usage",id:"sample-usage",level:2}];function p(e){const t={code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,a.a)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsxs)(t.p,{children:["This middleware automatically parses HTTP requests with URL-encoded body (typically the result\nof a form submit). Also handles gracefully broken URL encoding as ",(0,n.jsx)(t.em,{children:"Unsupported Media Type"})," (415 errors)"]}),"\n",(0,n.jsx)(t.h2,{id:"install",children:"Install"}),"\n",(0,n.jsx)(t.p,{children:"To install this middleware you can use NPM:"}),"\n",(0,n.jsxs)(l.Z,{groupId:"npm2yarn",children:[(0,n.jsx)(s.Z,{value:"npm",children:(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"npm install --save @middy/http-urlencode-body-parser\n"})})}),(0,n.jsx)(s.Z,{value:"yarn",label:"Yarn",children:(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"yarn add @middy/http-urlencode-body-parser\n"})})}),(0,n.jsx)(s.Z,{value:"pnpm",label:"pnpm",children:(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"pnpm add @middy/http-urlencode-body-parser\n"})})})]}),"\n",(0,n.jsx)(t.h2,{id:"options",children:"Options"}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"disableContentTypeError"})," (",(0,n.jsx)(t.code,{children:"boolean"}),") (optional): Skip throwing 415 when ",(0,n.jsx)(t.code,{children:"Content-Type"})," is invalid. Default: ",(0,n.jsx)(t.code,{children:"true"}),", will default to ",(0,n.jsx)(t.code,{children:"false"})," in next major version."]}),"\n"]}),"\n",(0,n.jsx)(t.h2,{id:"sample-usage",children:"Sample usage"}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport httpHeaderNormalizer from '@middy/http-header-normalizer'\nimport httpUrlEncodeBodyParser from '@middy/http-urlencode-body-parser'\n\nconst lambdaHandler = (event, context) => {\n  return event.body // propagates the body as response\n}\n\nexport const handler = middy()\n  .use(httpHeaderNormalizer())\n  .use(httpUrlEncodeBodyParser())\n  .handler(lambdaHandler)\n\n// When Lambda runs the handler with a sample event...\nconst event = {\n  headers: {\n    'Content-Type': 'application/x-www-form-urlencoded'\n  },\n  body: 'frappucino=muffin&goat%5B%5D=scone&pond=moose'\n}\n\nhandler(event, {}, (_, body) => {\n  t.deepEqual(body, {\n    frappucino: 'muffin',\n    'goat[]': 'scone',\n    pond: 'moose'\n  })\n})\n"})})]})}function h(e={}){const{wrapper:t}={...(0,a.a)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(p,{...e})}):p(e)}},5162:(e,t,r)=>{r.d(t,{Z:()=>s});r(7294);var n=r(6010);const a={tabItem:"tabItem_Ymn6"};var l=r(5893);function s(e){let{children:t,hidden:r,className:s}=e;return(0,l.jsx)("div",{role:"tabpanel",className:(0,n.Z)(a.tabItem,s),hidden:r,children:t})}},4866:(e,t,r)=>{r.d(t,{Z:()=>j});var n=r(7294),a=r(6010),l=r(2466),s=r(6550),o=r(469),i=r(1980),d=r(7392),u=r(12);function c(e){return n.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,n.isValidElement)(e)&&function(e){const{props:t}=e;return!!t&&"object"==typeof t&&"value"in t}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function p(e){const{values:t,children:r}=e;return(0,n.useMemo)((()=>{const e=t??function(e){return c(e).map((e=>{let{props:{value:t,label:r,attributes:n,default:a}}=e;return{value:t,label:r,attributes:n,default:a}}))}(r);return function(e){const t=(0,d.l)(e,((e,t)=>e.value===t.value));if(t.length>0)throw new Error(`Docusaurus error: Duplicate values "${t.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[t,r])}function h(e){let{value:t,tabValues:r}=e;return r.some((e=>e.value===t))}function m(e){let{queryString:t=!1,groupId:r}=e;const a=(0,s.k6)(),l=function(e){let{queryString:t=!1,groupId:r}=e;if("string"==typeof t)return t;if(!1===t)return null;if(!0===t&&!r)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return r??null}({queryString:t,groupId:r});return[(0,i._X)(l),(0,n.useCallback)((e=>{if(!l)return;const t=new URLSearchParams(a.location.search);t.set(l,e),a.replace({...a.location,search:t.toString()})}),[l,a])]}function b(e){const{defaultValue:t,queryString:r=!1,groupId:a}=e,l=p(e),[s,i]=(0,n.useState)((()=>function(e){let{defaultValue:t,tabValues:r}=e;if(0===r.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(t){if(!h({value:t,tabValues:r}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${t}" but none of its children has the corresponding value. Available values are: ${r.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return t}const n=r.find((e=>e.default))??r[0];if(!n)throw new Error("Unexpected error: 0 tabValues");return n.value}({defaultValue:t,tabValues:l}))),[d,c]=m({queryString:r,groupId:a}),[b,f]=function(e){let{groupId:t}=e;const r=function(e){return e?`docusaurus.tab.${e}`:null}(t),[a,l]=(0,u.Nk)(r);return[a,(0,n.useCallback)((e=>{r&&l.set(e)}),[r,l])]}({groupId:a}),y=(()=>{const e=d??b;return h({value:e,tabValues:l})?e:null})();(0,o.Z)((()=>{y&&i(y)}),[y]);return{selectedValue:s,selectValue:(0,n.useCallback)((e=>{if(!h({value:e,tabValues:l}))throw new Error(`Can't select invalid tab value=${e}`);i(e),c(e),f(e)}),[c,f,l]),tabValues:l}}var f=r(2389);const y={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var v=r(5893);function g(e){let{className:t,block:r,selectedValue:n,selectValue:s,tabValues:o}=e;const i=[],{blockElementScrollPositionUntilNextRender:d}=(0,l.o5)(),u=e=>{const t=e.currentTarget,r=i.indexOf(t),a=o[r].value;a!==n&&(d(t),s(a))},c=e=>{let t=null;switch(e.key){case"Enter":u(e);break;case"ArrowRight":{const r=i.indexOf(e.currentTarget)+1;t=i[r]??i[0];break}case"ArrowLeft":{const r=i.indexOf(e.currentTarget)-1;t=i[r]??i[i.length-1];break}}t?.focus()};return(0,v.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,a.Z)("tabs",{"tabs--block":r},t),children:o.map((e=>{let{value:t,label:r,attributes:l}=e;return(0,v.jsx)("li",{role:"tab",tabIndex:n===t?0:-1,"aria-selected":n===t,ref:e=>i.push(e),onKeyDown:c,onClick:u,...l,className:(0,a.Z)("tabs__item",y.tabItem,l?.className,{"tabs__item--active":n===t}),children:r??t},t)}))})}function x(e){let{lazy:t,children:r,selectedValue:a}=e;const l=(Array.isArray(r)?r:[r]).filter(Boolean);if(t){const e=l.find((e=>e.props.value===a));return e?(0,n.cloneElement)(e,{className:"margin-top--md"}):null}return(0,v.jsx)("div",{className:"margin-top--md",children:l.map(((e,t)=>(0,n.cloneElement)(e,{key:t,hidden:e.props.value!==a})))})}function w(e){const t=b(e);return(0,v.jsxs)("div",{className:(0,a.Z)("tabs-container",y.tabList),children:[(0,v.jsx)(g,{...e,...t}),(0,v.jsx)(x,{...e,...t})]})}function j(e){const t=(0,f.Z)();return(0,v.jsx)(w,{...e,children:c(e.children)},String(t))}},1151:(e,t,r)=>{r.d(t,{Z:()=>o,a:()=>s});var n=r(7294);const a={},l=n.createContext(a);function s(e){const t=n.useContext(l);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:s(e.components),n.createElement(l.Provider,{value:t},e.children)}}}]);