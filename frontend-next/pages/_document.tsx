import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    // Enforce light theme only: do not add or toggle `.dark` class
    const removeDarkClass = `try { document.documentElement.classList.remove('dark'); localStorage.setItem('theme','light'); } catch (e) {}`
    return (
      <Html lang="en">
        <Head>
          <script dangerouslySetInnerHTML={{ __html: removeDarkClass }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
