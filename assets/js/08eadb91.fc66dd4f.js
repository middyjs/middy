"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[1428],{7702:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>a,contentTitle:()=>o,default:()=>u,frontMatter:()=>s,metadata:()=>d,toc:()=>c});var r=t(5893),i=t(1151);const s={title:"Custom Middlewares",position:1},o=void 0,d={id:"writing-middlewares/intro",title:"Custom Middlewares",description:"A middleware is an object that should contain at least 1 of 3 possible keys:",source:"@site/docs/writing-middlewares/01-intro.md",sourceDirName:"writing-middlewares",slug:"/writing-middlewares/intro",permalink:"/docs/writing-middlewares/intro",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/writing-middlewares/01-intro.md",tags:[],version:"current",lastUpdatedAt:1700079159,formattedLastUpdatedAt:"Nov 15, 2023",sidebarPosition:1,frontMatter:{title:"Custom Middlewares",position:1},sidebar:"tutorialSidebar",previous:{title:"Writing Middlewares",permalink:"/docs/category/writing-middlewares"},next:{title:"Configurable Middlewares",permalink:"/docs/writing-middlewares/configurable-middlewares"}},a={},c=[];function l(e){const n={code:"code",em:"em",li:"li",ol:"ol",p:"p",pre:"pre",ul:"ul",...(0,i.a)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.p,{children:"A middleware is an object that should contain at least 1 of 3 possible keys:"}),"\n",(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"before"}),": a function that is executed in the before phase"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"after"}),": a function that is executed in the after phase"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"onError"}),": a function that is executed in case of errors"]}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:[(0,r.jsx)(n.code,{children:"before"}),", ",(0,r.jsx)(n.code,{children:"after"})," and ",(0,r.jsx)(n.code,{children:"onError"})," functions need to have the following signature:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-javascript",children:"const defaults = {\n  // ...\n}\n\nconst nameMiddleware = (opts = {}) => {\n  const options = { ...defaults, ...opts }\n\n  const nameMiddlewareBefore = async (request) => {\n    // ...\n  }\n  \n  const nameMiddlewareAfter = async (request) => {\n    // ...\n  }\n  \n  const nameMiddlewareOnError = async (request) => {\n    // ...\n  }\n  \n  return {\n    before: nameMiddlewareBefore,\n    after: nameMiddlewareAfter,\n    onError: nameMiddlewareOnError\n  }\n}\n\nexport default nameMiddleware\n"})}),"\n",(0,r.jsx)(n.p,{children:"Where:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"request"}),": is a reference to the current context and allows access to (and modification of)\nthe current ",(0,r.jsx)(n.code,{children:"event"})," (request), the ",(0,r.jsx)(n.code,{children:"response"})," (in the ",(0,r.jsx)(n.em,{children:"after"})," phase), and ",(0,r.jsx)(n.code,{children:"error"}),"\n(in case of an error)."]}),"\n"]})]})}function u(e={}){const{wrapper:n}={...(0,i.a)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(l,{...e})}):l(e)}},1151:(e,n,t)=>{t.d(n,{Z:()=>d,a:()=>o});var r=t(7294);const i={},s=r.createContext(i);function o(e){const n=r.useContext(s);return r.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function d(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),r.createElement(s.Provider,{value:n},e.children)}}}]);