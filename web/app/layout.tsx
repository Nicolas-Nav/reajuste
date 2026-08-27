import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reajuste | Cuanto vale hoy la plata de antes',
  description:
    'Calculadora de poder adquisitivo con indicadores economicos chilenos. Cuanto necesitas hoy para comprar lo mismo que hace unos anos, con datos del Banco Central desde 2010.',
  openGraph: {
    title: 'Reajuste | Cuanto vale hoy la plata de antes',
    description:
      'Calculadora de poder adquisitivo con indicadores economicos chilenos.',
    locale: 'es_CL',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
