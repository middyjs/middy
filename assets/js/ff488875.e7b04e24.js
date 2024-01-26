"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[1531],{4974:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>c,contentTitle:()=>d,default:()=>m,frontMatter:()=>i,metadata:()=>o,toc:()=>u});var n=a(5893),s=a(1151),r=a(4866),l=a(5162);const i={title:"ssm"},d=void 0,o={id:"middlewares/ssm",title:"ssm",description:"This middleware fetches parameters from AWS Systems Manager Parameter Store.",source:"@site/docs/middlewares/ssm.md",sourceDirName:"middlewares",slug:"/middlewares/ssm",permalink:"/docs/middlewares/ssm",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/middlewares/ssm.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",frontMatter:{title:"ssm"},sidebar:"tutorialSidebar",previous:{title:"sqs-partial-batch-failure",permalink:"/docs/middlewares/sqs-partial-batch-failure"},next:{title:"sts",permalink:"/docs/middlewares/sts"}},c={},u=[{value:"Install",id:"install",level:2},{value:"Options",id:"options",level:2},{value:"Sample usage",id:"sample-usage",level:2},{value:"Bundling",id:"bundling",level:2},{value:"Usage with TypeScript",id:"usage-with-typescript",level:2}];function h(e){const t={a:"a",code:"code",em:"em",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,s.a)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsxs)(t.p,{children:["This middleware fetches parameters from ",(0,n.jsx)(t.a,{href:"https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html",children:"AWS Systems Manager Parameter Store"}),"."]}),"\n",(0,n.jsxs)(t.p,{children:["Parameters to fetch can be defined by path and by name (not mutually exclusive). See AWS docs ",(0,n.jsx)(t.a,{href:"https://aws.amazon.com/blogs/mt/organize-parameters-by-hierarchy-tags-or-amazon-cloudwatch-events-with-amazon-ec2-systems-manager-parameter-store/",children:"here"}),"."]}),"\n",(0,n.jsxs)(t.p,{children:["Parameters can be assigned to the function handler's ",(0,n.jsx)(t.code,{children:"context"})," object by setting the ",(0,n.jsx)(t.code,{children:"setToContext"})," flag to ",(0,n.jsx)(t.code,{children:"true"}),". By default all parameters are added with uppercase names."]}),"\n",(0,n.jsx)(t.p,{children:"The Middleware makes a single API request to fetch all the parameters defined by name, but must make an additional request per specified path. This is because the AWS SDK currently doesn't expose a method to retrieve parameters from multiple paths."}),"\n",(0,n.jsxs)(t.p,{children:["For each parameter defined by name, you also provide the name under which its value should be added to ",(0,n.jsx)(t.code,{children:"context"}),". For each path, you instead provide a prefix, and by default the value import each parameter returned from that path will be added to ",(0,n.jsx)(t.code,{children:"context"})," with a name equal to what's left of the parameter's full name ",(0,n.jsx)(t.em,{children:"after"})," the defined path, with the prefix prepended. If the prefix is an empty string, nothing is prepended. You can override this behaviour by providing your own mapping function with the ",(0,n.jsx)(t.code,{children:"getParamNameFromPath"})," config option."]}),"\n",(0,n.jsx)(t.h2,{id:"install",children:"Install"}),"\n",(0,n.jsx)(t.p,{children:"To install this middleware you can use NPM:"}),"\n",(0,n.jsxs)(r.Z,{groupId:"npm2yarn",children:[(0,n.jsx)(l.Z,{value:"npm",children:(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"npm install --save @middy/ssm\nnpm install --save-dev @aws-sdk/client-ssm\n"})})}),(0,n.jsx)(l.Z,{value:"yarn",label:"Yarn",children:(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"yarn add @middy/ssm\nyarn add --dev @aws-sdk/client-ssm\n"})})}),(0,n.jsx)(l.Z,{value:"pnpm",label:"pnpm",children:(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"pnpm add @middy/ssm\npnpm add --save-dev @aws-sdk/client-ssm\n"})})})]}),"\n",(0,n.jsx)(t.h2,{id:"options",children:"Options"}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"AwsClient"})," (object) (default ",(0,n.jsx)(t.code,{children:"SSMClient"}),"): SSMClient class constructor (i.e. that has been instrumented with AWS X-Ray). Must be from ",(0,n.jsx)(t.code,{children:"@aws-sdk/client-ssm"}),"."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"awsClientOptions"})," (object) (optional): Options to pass to SSMClient class constructor."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"awsClientAssumeRole"})," (string) (optional): Internal key where role tokens are stored. See ",(0,n.jsx)(t.a,{href:"/docs/middlewares/sts",children:"@middy/sts"})," on to set this."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"awsClientCapture"})," (function) (optional): Enable AWS X-Ray by passing ",(0,n.jsx)(t.code,{children:"captureAWSv3Client"})," from ",(0,n.jsx)(t.code,{children:"aws-xray-sdk"})," in."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"fetchData"})," (object) (required): Mapping of internal key name to API request parameter ",(0,n.jsx)(t.code,{children:"Names"}),"/",(0,n.jsx)(t.code,{children:"Path"}),". ",(0,n.jsx)(t.code,{children:"SecureString"})," are automatically decrypted."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"disablePrefetch"})," (boolean) (default ",(0,n.jsx)(t.code,{children:"false"}),"): On cold start requests will trigger early if they can. Setting ",(0,n.jsx)(t.code,{children:"awsClientAssumeRole"})," disables prefetch."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"cacheKey"})," (string) (default ",(0,n.jsx)(t.code,{children:"ssm"}),"): Cache key for the fetched data responses. Must be unique across all middleware."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"cacheExpiry"})," (number) (default ",(0,n.jsx)(t.code,{children:"-1"}),"): How long fetch data responses should be cached for. ",(0,n.jsx)(t.code,{children:"-1"}),": cache forever, ",(0,n.jsx)(t.code,{children:"0"}),": never cache, ",(0,n.jsx)(t.code,{children:"n"}),": cache for n ms."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"setToContext"})," (boolean) (default ",(0,n.jsx)(t.code,{children:"false"}),"): Store role tokens to ",(0,n.jsx)(t.code,{children:"request.context"}),"."]}),"\n"]}),"\n",(0,n.jsx)(t.p,{children:"NOTES:"}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:["Lambda is required to have IAM permission for ",(0,n.jsx)(t.code,{children:"ssm:GetParameters"})," and/or ",(0,n.jsx)(t.code,{children:"ssm:GetParametersByPath"})," depending on what you're requesting, along with ",(0,n.jsx)(t.code,{children:"kms:Decrypt"}),"."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"SSM"})," has ",(0,n.jsx)(t.a,{href:"https://docs.aws.amazon.com/general/latest/gr/ssm.html",children:"throughput limitations"}),". Switching to Advanced Parameter type or increasing ",(0,n.jsx)(t.code,{children:"maxRetries"})," and ",(0,n.jsx)(t.code,{children:"retryDelayOptions.base"})," in ",(0,n.jsx)(t.code,{children:"awsClientOptions"})," may be required."]}),"\n"]}),"\n",(0,n.jsx)(t.h2,{id:"sample-usage",children:"Sample usage"}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport ssm from '@middy/ssm'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nlet globalDefaults = {}\nexport const handler = middy()\n  .use(\n    ssm({\n      fetchData: {\n        accessToken: '/dev/service_name/access_token', // single value\n        dbParams: '/dev/service_name/database/', // object of values, key for each path\n        defaults: '/dev/defaults'\n      },\n      setToContext: true\n    })\n  )\n  .before((request) => {\n    globalDefaults = request.context.defaults.global\n  })\n  .handler(lambdaHandler)\n"})}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport { getInternal } from '@middy/util'\nimport ssm from '@middy/ssm'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nlet globalDefaults = {}\nexport const handler = middy()\n  .use(\n    ssm({\n      fetchData: {\n        defaults: '/dev/defaults'\n      },\n      cacheKey: 'ssm-defaults'\n    })\n  )\n  .use(\n    ssm({\n      fetchData: {\n        accessToken: '/dev/service_name/access_token', // single value\n        dbParams: '/dev/service_name/database/' // object of values, key for each path\n      },\n      cacheExpiry: 15 * 60 * 1000,\n      cacheKey: 'ssm-secrets'\n    })\n  )\n  // ... other middleware that fetch\n  .before(async (request) => {\n    const data = await getInternal(\n      ['accessToken', 'dbParams', 'defaults'],\n      request\n    )\n    Object.assign(request.context, data)\n  })\n  .handler(lambdaHandler)\n"})}),"\n",(0,n.jsx)(t.h2,{id:"bundling",children:"Bundling"}),"\n",(0,n.jsxs)(t.p,{children:["To exclude ",(0,n.jsx)(t.code,{children:"@aws-sdk"})," add ",(0,n.jsx)(t.code,{children:"@aws-sdk/client-ssm"})," to the exclude list."]}),"\n",(0,n.jsx)(t.h2,{id:"usage-with-typescript",children:"Usage with TypeScript"}),"\n",(0,n.jsxs)(t.p,{children:["Data in SSM can be stored as arbitrary JSON values. It's not possible to know in advance what shape the fetched SSM parameters will have, so by default the fetched parameters will have type ",(0,n.jsx)(t.code,{children:"unknown"}),"."]}),"\n",(0,n.jsxs)(t.p,{children:["You can provide some type hints by leveraging the ",(0,n.jsx)(t.code,{children:"ssmParam"})," utility function. This function allows you to specify what's the expected type that will be fetched for every parameter."]}),"\n",(0,n.jsxs)(t.p,{children:["The idea is that, for every parameter specified in the ",(0,n.jsx)(t.code,{children:"fetchData"})," option, rather than just providing the parameter path as a string, you can wrap it in a ",(0,n.jsx)(t.code,{children:"ssmParam<ParamType>(parameterPath)"})," call. Internally, ",(0,n.jsx)(t.code,{children:"ssmParam"})," is a function that will return ",(0,n.jsx)(t.code,{children:"parameterPath"})," as received, but it allows you to use generics to provide type hints for the expected type for that parameter."]}),"\n",(0,n.jsx)(t.p,{children:"This way TypeScript can understand how to treat the additional data attached to the context and stored in the internal storage."}),"\n",(0,n.jsxs)(t.p,{children:["The following example illustrates how to use ",(0,n.jsx)(t.code,{children:"ssmParam"}),":"]}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-typescript",children:"import middy from '@middy/core'\nimport { getInternal } from '@middy/util'\nimport ssm, { ssmParam } from '@middy/ssm'\n\nconst lambdaHandler = (event, context) => {\n  return {}\n}\n\nlet globalDefaults = {}\nexport const handler = middy()\n  .use(\n    ssm({\n      fetchData: {\n        accessToken: ssmParam<string>('/dev/service_name/access_token'), // single value (will be typed as string)\n        dbParams: ssmParam<{ user: string; pass: string }>(\n          '/dev/service_name/database/'\n        ) // object of values (typed as {user: string, pass: string})\n      },\n      cacheExpiry: 15 * 60 * 1000,\n      cacheKey: 'ssm-secrets'\n    })\n  )\n  // ... other middleware that fetch\n  .before(async (request) => {\n    const data = await getInternal(['accessToken', 'dbParams'], request)\n    // data.accessToken (string)\n    // data.dbParams ({user: string, pass: string})\n  })\n  .handler(lambdaHandler)\n"})})]})}function m(e={}){const{wrapper:t}={...(0,s.a)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(h,{...e})}):h(e)}},5162:(e,t,a)=>{a.d(t,{Z:()=>l});a(7294);var n=a(6010);const s={tabItem:"tabItem_Ymn6"};var r=a(5893);function l(e){let{children:t,hidden:a,className:l}=e;return(0,r.jsx)("div",{role:"tabpanel",className:(0,n.Z)(s.tabItem,l),hidden:a,children:t})}},4866:(e,t,a)=>{a.d(t,{Z:()=>w});var n=a(7294),s=a(6010),r=a(2466),l=a(6550),i=a(469),d=a(1980),o=a(7392),c=a(12);function u(e){return n.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,n.isValidElement)(e)&&function(e){const{props:t}=e;return!!t&&"object"==typeof t&&"value"in t}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:t,children:a}=e;return(0,n.useMemo)((()=>{const e=t??function(e){return u(e).map((e=>{let{props:{value:t,label:a,attributes:n,default:s}}=e;return{value:t,label:a,attributes:n,default:s}}))}(a);return function(e){const t=(0,o.l)(e,((e,t)=>e.value===t.value));if(t.length>0)throw new Error(`Docusaurus error: Duplicate values "${t.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[t,a])}function m(e){let{value:t,tabValues:a}=e;return a.some((e=>e.value===t))}function p(e){let{queryString:t=!1,groupId:a}=e;const s=(0,l.k6)(),r=function(e){let{queryString:t=!1,groupId:a}=e;if("string"==typeof t)return t;if(!1===t)return null;if(!0===t&&!a)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return a??null}({queryString:t,groupId:a});return[(0,d._X)(r),(0,n.useCallback)((e=>{if(!r)return;const t=new URLSearchParams(s.location.search);t.set(r,e),s.replace({...s.location,search:t.toString()})}),[r,s])]}function f(e){const{defaultValue:t,queryString:a=!1,groupId:s}=e,r=h(e),[l,d]=(0,n.useState)((()=>function(e){let{defaultValue:t,tabValues:a}=e;if(0===a.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(t){if(!m({value:t,tabValues:a}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${t}" but none of its children has the corresponding value. Available values are: ${a.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return t}const n=a.find((e=>e.default))??a[0];if(!n)throw new Error("Unexpected error: 0 tabValues");return n.value}({defaultValue:t,tabValues:r}))),[o,u]=p({queryString:a,groupId:s}),[f,x]=function(e){let{groupId:t}=e;const a=function(e){return e?`docusaurus.tab.${e}`:null}(t),[s,r]=(0,c.Nk)(a);return[s,(0,n.useCallback)((e=>{a&&r.set(e)}),[a,r])]}({groupId:s}),b=(()=>{const e=o??f;return m({value:e,tabValues:r})?e:null})();(0,i.Z)((()=>{b&&d(b)}),[b]);return{selectedValue:l,selectValue:(0,n.useCallback)((e=>{if(!m({value:e,tabValues:r}))throw new Error(`Can't select invalid tab value=${e}`);d(e),u(e),x(e)}),[u,x,r]),tabValues:r}}var x=a(2389);const b={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var y=a(5893);function j(e){let{className:t,block:a,selectedValue:n,selectValue:l,tabValues:i}=e;const d=[],{blockElementScrollPositionUntilNextRender:o}=(0,r.o5)(),c=e=>{const t=e.currentTarget,a=d.indexOf(t),s=i[a].value;s!==n&&(o(t),l(s))},u=e=>{let t=null;switch(e.key){case"Enter":c(e);break;case"ArrowRight":{const a=d.indexOf(e.currentTarget)+1;t=d[a]??d[0];break}case"ArrowLeft":{const a=d.indexOf(e.currentTarget)-1;t=d[a]??d[d.length-1];break}}t?.focus()};return(0,y.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,s.Z)("tabs",{"tabs--block":a},t),children:i.map((e=>{let{value:t,label:a,attributes:r}=e;return(0,y.jsx)("li",{role:"tab",tabIndex:n===t?0:-1,"aria-selected":n===t,ref:e=>d.push(e),onKeyDown:u,onClick:c,...r,className:(0,s.Z)("tabs__item",b.tabItem,r?.className,{"tabs__item--active":n===t}),children:a??t},t)}))})}function g(e){let{lazy:t,children:a,selectedValue:s}=e;const r=(Array.isArray(a)?a:[a]).filter(Boolean);if(t){const e=r.find((e=>e.props.value===s));return e?(0,n.cloneElement)(e,{className:"margin-top--md"}):null}return(0,y.jsx)("div",{className:"margin-top--md",children:r.map(((e,t)=>(0,n.cloneElement)(e,{key:t,hidden:e.props.value!==s})))})}function v(e){const t=f(e);return(0,y.jsxs)("div",{className:(0,s.Z)("tabs-container",b.tabList),children:[(0,y.jsx)(j,{...e,...t}),(0,y.jsx)(g,{...e,...t})]})}function w(e){const t=(0,x.Z)();return(0,y.jsx)(v,{...e,children:u(e.children)},String(t))}},1151:(e,t,a)=>{a.d(t,{Z:()=>i,a:()=>l});var n=a(7294);const s={},r=n.createContext(s);function l(e){const t=n.useContext(r);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function i(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:l(e.components),n.createElement(r.Provider,{value:t},e.children)}}}]);