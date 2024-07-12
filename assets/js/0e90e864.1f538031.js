"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[1469],{3048:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>i,default:()=>m,frontMatter:()=>c,metadata:()=>o,toc:()=>u});var s=n(5893),r=n(1151),a=n(4866),l=n(5162);const c={title:"secrets-manager"},i=void 0,o={id:"middlewares/secrets-manager",title:"secrets-manager",description:"This middleware fetches secrets from AWS Secrets Manager.",source:"@site/docs/middlewares/secrets-manager.md",sourceDirName:"middlewares",slug:"/middlewares/secrets-manager",permalink:"/docs/middlewares/secrets-manager",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/middlewares/secrets-manager.md",tags:[],version:"current",lastUpdatedAt:1720751005,formattedLastUpdatedAt:"Jul 12, 2024",frontMatter:{title:"secrets-manager"},sidebar:"tutorialSidebar",previous:{title:"s3",permalink:"/docs/middlewares/s3"},next:{title:"service-discovery",permalink:"/docs/middlewares/service-discovery"}},d={},u=[{value:"Install",id:"install",level:2},{value:"Options",id:"options",level:2},{value:"Sample usage",id:"sample-usage",level:2},{value:"Bundling",id:"bundling",level:2},{value:"Usage with TypeScript",id:"usage-with-typescript",level:2}];function h(e){const t={a:"a",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,r.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsxs)(t.p,{children:["This middleware fetches secrets from ",(0,s.jsx)(t.a,{href:"https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html",children:"AWS Secrets Manager"}),"."]}),"\n",(0,s.jsxs)(t.p,{children:["Secrets to fetch can be defined by by name. See AWS docs ",(0,s.jsx)(t.a,{href:"https://docs.aws.amazon.com/secretsmanager/latest/userguide/tutorials_basic.html",children:"here"}),"."]}),"\n",(0,s.jsxs)(t.p,{children:["Secrets are assigned to the function handler's ",(0,s.jsx)(t.code,{children:"context"})," object."]}),"\n",(0,s.jsxs)(t.p,{children:["The Middleware makes a single ",(0,s.jsx)(t.a,{href:"https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html",children:"API request"})," for each secret as Secrets Manager does not support batch get."]}),"\n",(0,s.jsxs)(t.p,{children:["For each secret, you also provide the name under which its value should be added to ",(0,s.jsx)(t.code,{children:"context"}),"."]}),"\n",(0,s.jsx)(t.h2,{id:"install",children:"Install"}),"\n",(0,s.jsx)(t.p,{children:"To install this middleware you can use NPM:"}),"\n",(0,s.jsxs)(a.Z,{groupId:"npm2yarn",children:[(0,s.jsx)(l.Z,{value:"npm",children:(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-bash",children:"npm install --save @middy/secrets-manager\nnpm install --save-dev @aws-sdk/client-secrets-manager\n"})})}),(0,s.jsx)(l.Z,{value:"yarn",label:"Yarn",children:(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-bash",children:"yarn add @middy/secrets-manager\nyarn add --dev @aws-sdk/client-secrets-manager\n"})})}),(0,s.jsx)(l.Z,{value:"pnpm",label:"pnpm",children:(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-bash",children:"pnpm add @middy/secrets-manager\npnpm add --save-dev @aws-sdk/client-secrets-manager\n"})})})]}),"\n",(0,s.jsx)(t.h2,{id:"options",children:"Options"}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"AwsClient"})," (object) (default ",(0,s.jsx)(t.code,{children:"SecretsManagerClient"}),"): SecretsManagerClient class constructor (i.e. that has been instrumented with AWS XRay). Must be from ",(0,s.jsx)(t.code,{children:"@aws-sdk/client-secrets-manager"}),"."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"awsClientOptions"})," (object) (optional): Options to pass to SecretsManagerClient class constructor."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"awsClientAssumeRole"})," (string) (optional): Internal key where secrets are stored. See ",(0,s.jsx)(t.a,{href:"/docs/middlewares/sts",children:"@middy/sts"})," on to set this."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"awsClientCapture"})," (function) (optional): Enable XRay by passing ",(0,s.jsx)(t.code,{children:"captureAWSv3Client"})," from ",(0,s.jsx)(t.code,{children:"aws-xray-sdk"})," in."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"fetchData"})," (object) (required): Mapping of internal key name to API request parameter ",(0,s.jsx)(t.code,{children:"SecretId"}),"."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"fetchRotationDate"})," (boolean|object) (default ",(0,s.jsx)(t.code,{children:"false"}),"): Boolean to apply to all or mapping of internal key name to boolean. This indicates what secrets should fetch and cached based on ",(0,s.jsx)(t.code,{children:"NextRotationDate"}),"/",(0,s.jsx)(t.code,{children:"LastRotationDate"}),"/",(0,s.jsx)(t.code,{children:"LastChangedDate"}),". ",(0,s.jsx)(t.code,{children:"cacheExpiry"})," of ",(0,s.jsx)(t.code,{children:"-1"})," will use ",(0,s.jsx)(t.code,{children:"NextRotationDate"}),", while any other value will be added to the ",(0,s.jsx)(t.code,{children:"LastRotationDate"})," or ",(0,s.jsx)(t.code,{children:"LastChangedDate"}),", whichever is more recent. If secrets have different rotation schedules, use multiple instances of this middleware."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"disablePrefetch"})," (boolean) (default ",(0,s.jsx)(t.code,{children:"false"}),"): On cold start requests will trigger early if they can. Setting ",(0,s.jsx)(t.code,{children:"awsClientAssumeRole"})," disables prefetch."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"cacheKey"})," (string) (default ",(0,s.jsx)(t.code,{children:"secrets-manager"}),"): Cache key for the fetched data responses. Must be unique across all middleware."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"cacheExpiry"})," (number) (default ",(0,s.jsx)(t.code,{children:"-1"}),"): How long fetch data responses should be cached for. ",(0,s.jsx)(t.code,{children:"-1"}),": cache forever, ",(0,s.jsx)(t.code,{children:"0"}),": never cache, ",(0,s.jsx)(t.code,{children:"n"}),": cache for n ms."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.code,{children:"setToContext"})," (boolean) (default ",(0,s.jsx)(t.code,{children:"false"}),"): Store secrets to ",(0,s.jsx)(t.code,{children:"request.context"}),"."]}),"\n"]}),"\n",(0,s.jsx)(t.p,{children:"NOTES:"}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsxs)(t.li,{children:["Lambda is required to have IAM permission for ",(0,s.jsx)(t.code,{children:"secretsmanager:GetSecretValue"}),". If using ",(0,s.jsx)(t.code,{children:"fetchRotationDate"})," add ",(0,s.jsx)(t.code,{children:"secretsmanager:DescribeSecret"})," in as well."]}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"sample-usage",children:"Sample usage"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport secretsManager from '@middy/secrets-manager'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nexport const handler = middy()\n  .use(\n    secretsManager({\n      fetchData: {\n        apiToken: 'dev/api_token'\n      },\n      awsClientOptions: {\n        region: 'us-east-1'\n      },\n      setToContext: true\n    })\n  )\n  .handler(lambdaHandler)\n\n// Before running the function handler, the middleware will fetch from Secrets Manager\nhandler(event, context, (_, response) => {\n  // assuming the dev/api_token has two keys, 'Username' and 'Password'\n  equal(context.apiToken.Username, 'username')\n  equal(context.apiToken.Password, 'password')\n})\n"})}),"\n",(0,s.jsx)(t.h2,{id:"bundling",children:"Bundling"}),"\n",(0,s.jsxs)(t.p,{children:["To exclude ",(0,s.jsx)(t.code,{children:"@aws-sdk"})," add ",(0,s.jsx)(t.code,{children:"@aws-sdk/client-secrets-manager"})," to the exclude list."]}),"\n",(0,s.jsx)(t.h2,{id:"usage-with-typescript",children:"Usage with TypeScript"}),"\n",(0,s.jsxs)(t.p,{children:["Data stored in SecretsManager can be stored as arbitrary structured data. It's not possible to know in advance what shape the fetched data will have, so by default the fetched secrets will have type ",(0,s.jsx)(t.code,{children:"unknown"}),"."]}),"\n",(0,s.jsxs)(t.p,{children:["You can provide some type hints by leveraging the ",(0,s.jsx)(t.code,{children:"secret"})," utility function. This function allows you to specify what's the expected type that will be fetched for every SecretsManager request."]}),"\n",(0,s.jsxs)(t.p,{children:["The idea is that, for every request specified in the ",(0,s.jsx)(t.code,{children:"fetchData"})," option, rather than just providing the parameter configuration as an object, you can wrap it in a ",(0,s.jsx)(t.code,{children:"secret<ParamType>(key)"})," call. Internally, ",(0,s.jsx)(t.code,{children:"secret"})," is a function that will return ",(0,s.jsx)(t.code,{children:"key"})," as received, but it allows you to use generics to provide type hints for the expected fetched value type for that request."]}),"\n",(0,s.jsx)(t.p,{children:"This way TypeScript can understand how to treat the additional data attached to the context and stored in the internal storage."}),"\n",(0,s.jsxs)(t.p,{children:["The following example illustrates how to use ",(0,s.jsx)(t.code,{children:"secret"}),":"]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-typescript",children:"import middy from '@middy/core'\nimport secretsManager, { secret } from '@middy/secrets-manager'\n\nconst lambdaHandler = (event, context) => {\n  console.log(context.config)\n  const response = {\n    statusCode: 200,\n    headers: {},\n    body: JSON.stringify({ message: 'hello world' })\n  }\n\n  return response\n}\n\nexport const handler = middy()\n.use(\n  secretsManager({\n    fetchData: {\n      someSecret: secret<{User: string, Password: string}>('someHiddenSecret')\n    }),\n    setToContext: true\n  })\n)\n.before(async (request) => {\n  const data = await getInternal('someSecret', request)\n  // data.someSecret.User (string)\n  // data.someSecret.Password (string)\n  // or, since we have `setToContext: true`\n  // request.context.someSecret.User (string)\n  // request.context.someSecret.Password (string)\n})\n.handler(lambdaHandler)\n"})})]})}function m(e={}){const{wrapper:t}={...(0,r.a)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},5162:(e,t,n)=>{n.d(t,{Z:()=>l});n(7294);var s=n(6010);const r={tabItem:"tabItem_Ymn6"};var a=n(5893);function l(e){let{children:t,hidden:n,className:l}=e;return(0,a.jsx)("div",{role:"tabpanel",className:(0,s.Z)(r.tabItem,l),hidden:n,children:t})}},4866:(e,t,n)=>{n.d(t,{Z:()=>y});var s=n(7294),r=n(6010),a=n(2466),l=n(6550),c=n(469),i=n(1980),o=n(7392),d=n(12);function u(e){return s.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,s.isValidElement)(e)&&function(e){const{props:t}=e;return!!t&&"object"==typeof t&&"value"in t}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:t,children:n}=e;return(0,s.useMemo)((()=>{const e=t??function(e){return u(e).map((e=>{let{props:{value:t,label:n,attributes:s,default:r}}=e;return{value:t,label:n,attributes:s,default:r}}))}(n);return function(e){const t=(0,o.l)(e,((e,t)=>e.value===t.value));if(t.length>0)throw new Error(`Docusaurus error: Duplicate values "${t.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[t,n])}function m(e){let{value:t,tabValues:n}=e;return n.some((e=>e.value===t))}function p(e){let{queryString:t=!1,groupId:n}=e;const r=(0,l.k6)(),a=function(e){let{queryString:t=!1,groupId:n}=e;if("string"==typeof t)return t;if(!1===t)return null;if(!0===t&&!n)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return n??null}({queryString:t,groupId:n});return[(0,i._X)(a),(0,s.useCallback)((e=>{if(!a)return;const t=new URLSearchParams(r.location.search);t.set(a,e),r.replace({...r.location,search:t.toString()})}),[a,r])]}function f(e){const{defaultValue:t,queryString:n=!1,groupId:r}=e,a=h(e),[l,i]=(0,s.useState)((()=>function(e){let{defaultValue:t,tabValues:n}=e;if(0===n.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(t){if(!m({value:t,tabValues:n}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${t}" but none of its children has the corresponding value. Available values are: ${n.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return t}const s=n.find((e=>e.default))??n[0];if(!s)throw new Error("Unexpected error: 0 tabValues");return s.value}({defaultValue:t,tabValues:a}))),[o,u]=p({queryString:n,groupId:r}),[f,x]=function(e){let{groupId:t}=e;const n=function(e){return e?`docusaurus.tab.${e}`:null}(t),[r,a]=(0,d.Nk)(n);return[r,(0,s.useCallback)((e=>{n&&a.set(e)}),[n,a])]}({groupId:r}),g=(()=>{const e=o??f;return m({value:e,tabValues:a})?e:null})();(0,c.Z)((()=>{g&&i(g)}),[g]);return{selectedValue:l,selectValue:(0,s.useCallback)((e=>{if(!m({value:e,tabValues:a}))throw new Error(`Can't select invalid tab value=${e}`);i(e),u(e),x(e)}),[u,x,a]),tabValues:a}}var x=n(2389);const g={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var j=n(5893);function b(e){let{className:t,block:n,selectedValue:s,selectValue:l,tabValues:c}=e;const i=[],{blockElementScrollPositionUntilNextRender:o}=(0,a.o5)(),d=e=>{const t=e.currentTarget,n=i.indexOf(t),r=c[n].value;r!==s&&(o(t),l(r))},u=e=>{let t=null;switch(e.key){case"Enter":d(e);break;case"ArrowRight":{const n=i.indexOf(e.currentTarget)+1;t=i[n]??i[0];break}case"ArrowLeft":{const n=i.indexOf(e.currentTarget)-1;t=i[n]??i[i.length-1];break}}t?.focus()};return(0,j.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,r.Z)("tabs",{"tabs--block":n},t),children:c.map((e=>{let{value:t,label:n,attributes:a}=e;return(0,j.jsx)("li",{role:"tab",tabIndex:s===t?0:-1,"aria-selected":s===t,ref:e=>i.push(e),onKeyDown:u,onClick:d,...a,className:(0,r.Z)("tabs__item",g.tabItem,a?.className,{"tabs__item--active":s===t}),children:n??t},t)}))})}function v(e){let{lazy:t,children:n,selectedValue:r}=e;const a=(Array.isArray(n)?n:[n]).filter(Boolean);if(t){const e=a.find((e=>e.props.value===r));return e?(0,s.cloneElement)(e,{className:"margin-top--md"}):null}return(0,j.jsx)("div",{className:"margin-top--md",children:a.map(((e,t)=>(0,s.cloneElement)(e,{key:t,hidden:e.props.value!==r})))})}function w(e){const t=f(e);return(0,j.jsxs)("div",{className:(0,r.Z)("tabs-container",g.tabList),children:[(0,j.jsx)(b,{...e,...t}),(0,j.jsx)(v,{...e,...t})]})}function y(e){const t=(0,x.Z)();return(0,j.jsx)(w,{...e,children:u(e.children)},String(t))}},1151:(e,t,n)=>{n.d(t,{Z:()=>c,a:()=>l});var s=n(7294);const r={},a=s.createContext(r);function l(e){const t=s.useContext(a);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(a.Provider,{value:t},e.children)}}}]);