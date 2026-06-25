import { Inter } from "next/font/google";
import "./globals.css";
import 'react-toastify/dist/ReactToastify.css';
import 'react-toastify/ReactToastify.min.css';
import 'react-photo-view/dist/react-photo-view.css';
import { GoogleAnalytics } from '@next/third-parties/google'


const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "图床",
  description: "图床",
};



export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`}} />
      </head>
      <body className={inter.className}>{children}</body>
      <GoogleAnalytics gaId="G-JVKEXR5XSG" />
    </html>
  );
}
