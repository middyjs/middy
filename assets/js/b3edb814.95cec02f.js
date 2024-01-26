"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[3786],{7963:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>d,contentTitle:()=>o,default:()=>p,frontMatter:()=>i,metadata:()=>c,toc:()=>u});var s=t(5893),r=t(1151),a=t(4866),l=t(5162);const i={title:"sts"},o=void 0,c={id:"middlewares/sts",title:"sts",description:"Fetches STS credentials to be used when connecting to other AWS services.",source:"@site/docs/middlewares/sts.md",sourceDirName:"middlewares",slug:"/middlewares/sts",permalink:"/docs/middlewares/sts",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/middlewares/sts.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",frontMatter:{title:"sts"},sidebar:"tutorialSidebar",previous:{title:"ssm",permalink:"/docs/middlewares/ssm"},next:{title:"validator",permalink:"/docs/middlewares/validator"}},d={},u=[{value:"Install",id:"install",level:2},{value:"Options",id:"options",level:2},{value:"Sample usage",id:"sample-usage",level:2},{value:"Bundling",id:"bundling",level:2}];function h(e){const n={code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,r.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.p,{children:"Fetches STS credentials to be used when connecting to other AWS services."}),"\n",(0,s.jsx)(n.h2,{id:"install",children:"Install"}),"\n",(0,s.jsx)(n.p,{children:"To install this middleware you can use NPM:"}),"\n",(0,s.jsxs)(a.Z,{groupId:"npm2yarn",children:[(0,s.jsx)(l.Z,{value:"npm",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"npm install --save @middy/sts\nnpm install --save-dev @aws-sdk/client-sts\n"})})}),(0,s.jsx)(l.Z,{value:"yarn",label:"Yarn",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"yarn add @middy/sts\nyarn add --dev @aws-sdk/client-sts\n"})})}),(0,s.jsx)(l.Z,{value:"pnpm",label:"pnpm",children:(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"pnpm add @middy/sts\npnpm add --save-dev @aws-sdk/client-sts\n"})})})]}),"\n",(0,s.jsx)(n.h2,{id:"options",children:"Options"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"AwsClient"})," (object) (default ",(0,s.jsx)(n.code,{children:"STSClient"}),"): STSClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from ",(0,s.jsx)(n.code,{children:"@aws-sdk/client-sts"}),"."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"awsClientOptions"})," (object) (optional): Options to pass to STSClient class constructor."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"awsClientCapture"})," (function) (optional): Enable XRay by passing ",(0,s.jsx)(n.code,{children:"captureAWSv3Client"})," from ",(0,s.jsx)(n.code,{children:"aws-xray-sdk"})," in."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"fetchData"})," (object) (required): Mapping of internal key name to API request parameters."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"disablePrefetch"})," (boolean) (default ",(0,s.jsx)(n.code,{children:"false"}),"): On cold start requests will trigger early if they can. Setting ",(0,s.jsx)(n.code,{children:"awsClientAssumeRole"})," disables prefetch."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"cacheKey"})," (string) (default ",(0,s.jsx)(n.code,{children:"sts"}),"): Cache key for the fetched data responses. Must be unique across all middleware."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"cacheExpiry"})," (number) (default ",(0,s.jsx)(n.code,{children:"-1"}),"): How long fetch data responses should be cached for. ",(0,s.jsx)(n.code,{children:"-1"}),": cache forever, ",(0,s.jsx)(n.code,{children:"0"}),": never cache, ",(0,s.jsx)(n.code,{children:"n"}),": cache for n ms."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"setToContext"})," (boolean) (default ",(0,s.jsx)(n.code,{children:"false"}),"): Store credentials to ",(0,s.jsx)(n.code,{children:"request.context"}),"."]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"NOTES:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["Lambda is required to have IAM permission for ",(0,s.jsx)(n.code,{children:"sts:AssumeRole"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.code,{children:"setToContext"})," are included for legacy support and should be avoided for performance and security reasons. See main documentation for best practices."]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"sample-usage",children:"Sample usage"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport sts from '@middy/sts'\n\nconst lambdaHandler = (event, context) => {\n  const response = {\n    statusCode: 200,\n    headers: {},\n    body: JSON.stringify({ message: 'hello world' })\n  }\n\n  return response\n}\n\nexport const handler = middy()\n  .use(\n    sts({\n      fetchData: {\n        assumeRole: {\n          RoleArn: '...',\n          RoleSessionName: '' // optional\n        }\n      }\n    })\n  )\n  .handler(lambdaHandler)\n"})}),"\n",(0,s.jsx)(n.h2,{id:"bundling",children:"Bundling"}),"\n",(0,s.jsxs)(n.p,{children:["To exclude ",(0,s.jsx)(n.code,{children:"@aws-sdk"})," add ",(0,s.jsx)(n.code,{children:"@aws-sdk/client-sts"})," to the exclude list."]})]})}function p(e={}){const{wrapper:n}={...(0,r.a)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},5162:(e,n,t)=>{t.d(n,{Z:()=>l});t(7294);var s=t(6010);const r={tabItem:"tabItem_Ymn6"};var a=t(5893);function l(e){let{children:n,hidden:t,className:l}=e;return(0,a.jsx)("div",{role:"tabpanel",className:(0,s.Z)(r.tabItem,l),hidden:t,children:n})}},4866:(e,n,t)=>{t.d(n,{Z:()=>w});var s=t(7294),r=t(6010),a=t(2466),l=t(6550),i=t(469),o=t(1980),c=t(7392),d=t(12);function u(e){return s.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,s.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:n,children:t}=e;return(0,s.useMemo)((()=>{const e=n??function(e){return u(e).map((e=>{let{props:{value:n,label:t,attributes:s,default:r}}=e;return{value:n,label:t,attributes:s,default:r}}))}(t);return function(e){const n=(0,c.l)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,t])}function p(e){let{value:n,tabValues:t}=e;return t.some((e=>e.value===n))}function m(e){let{queryString:n=!1,groupId:t}=e;const r=(0,l.k6)(),a=function(e){let{queryString:n=!1,groupId:t}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!t)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return t??null}({queryString:n,groupId:t});return[(0,o._X)(a),(0,s.useCallback)((e=>{if(!a)return;const n=new URLSearchParams(r.location.search);n.set(a,e),r.replace({...r.location,search:n.toString()})}),[a,r])]}function f(e){const{defaultValue:n,queryString:t=!1,groupId:r}=e,a=h(e),[l,o]=(0,s.useState)((()=>function(e){let{defaultValue:n,tabValues:t}=e;if(0===t.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!p({value:n,tabValues:t}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${t.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const s=t.find((e=>e.default))??t[0];if(!s)throw new Error("Unexpected error: 0 tabValues");return s.value}({defaultValue:n,tabValues:a}))),[c,u]=m({queryString:t,groupId:r}),[f,b]=function(e){let{groupId:n}=e;const t=function(e){return e?`docusaurus.tab.${e}`:null}(n),[r,a]=(0,d.Nk)(t);return[r,(0,s.useCallback)((e=>{t&&a.set(e)}),[t,a])]}({groupId:r}),x=(()=>{const e=c??f;return p({value:e,tabValues:a})?e:null})();(0,i.Z)((()=>{x&&o(x)}),[x]);return{selectedValue:l,selectValue:(0,s.useCallback)((e=>{if(!p({value:e,tabValues:a}))throw new Error(`Can't select invalid tab value=${e}`);o(e),u(e),b(e)}),[u,b,a]),tabValues:a}}var b=t(2389);const x={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var j=t(5893);function v(e){let{className:n,block:t,selectedValue:s,selectValue:l,tabValues:i}=e;const o=[],{blockElementScrollPositionUntilNextRender:c}=(0,a.o5)(),d=e=>{const n=e.currentTarget,t=o.indexOf(n),r=i[t].value;r!==s&&(c(n),l(r))},u=e=>{let n=null;switch(e.key){case"Enter":d(e);break;case"ArrowRight":{const t=o.indexOf(e.currentTarget)+1;n=o[t]??o[0];break}case"ArrowLeft":{const t=o.indexOf(e.currentTarget)-1;n=o[t]??o[o.length-1];break}}n?.focus()};return(0,j.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,r.Z)("tabs",{"tabs--block":t},n),children:i.map((e=>{let{value:n,label:t,attributes:a}=e;return(0,j.jsx)("li",{role:"tab",tabIndex:s===n?0:-1,"aria-selected":s===n,ref:e=>o.push(e),onKeyDown:u,onClick:d,...a,className:(0,r.Z)("tabs__item",x.tabItem,a?.className,{"tabs__item--active":s===n}),children:t??n},n)}))})}function g(e){let{lazy:n,children:t,selectedValue:r}=e;const a=(Array.isArray(t)?t:[t]).filter(Boolean);if(n){const e=a.find((e=>e.props.value===r));return e?(0,s.cloneElement)(e,{className:"margin-top--md"}):null}return(0,j.jsx)("div",{className:"margin-top--md",children:a.map(((e,n)=>(0,s.cloneElement)(e,{key:n,hidden:e.props.value!==r})))})}function y(e){const n=f(e);return(0,j.jsxs)("div",{className:(0,r.Z)("tabs-container",x.tabList),children:[(0,j.jsx)(v,{...e,...n}),(0,j.jsx)(g,{...e,...n})]})}function w(e){const n=(0,b.Z)();return(0,j.jsx)(y,{...e,children:u(e.children)},String(n))}},1151:(e,n,t)=>{t.d(n,{Z:()=>i,a:()=>l});var s=t(7294);const r={},a=s.createContext(r);function l(e){const n=s.useContext(a);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(a.Provider,{value:n},e.children)}}}]);