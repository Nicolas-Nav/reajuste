import { Calculadora } from '@/components/Calculadora'

export default function Inicio() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      {/*
        El contenedor es ancho para aprovechar la pantalla, pero los parrafos se
        limitan aparte: una linea de texto de 1.100 px es incomoda de leer.
      */}
      <header>
        <p className="font-mono text-xs tracking-[0.2em] text-marca uppercase">Reajuste</p>

        <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,6vw,4rem)] leading-[1.03] font-semibold tracking-tight text-balance">
          Cuanto vale hoy la plata de antes
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-tenue text-pretty">
          Escribe un monto y el mes en que lo tenias. Te digo cuanto necesitarias hoy
          para comprar lo mismo, con datos del Banco Central desde 2010.
        </p>
      </header>

      <Calculadora />

      <section className="mt-20 border-t border-linea pt-10">
        <h2 className="text-sm font-semibold text-tinta">Como se calcula</h2>

        <div className="mt-4 grid gap-6 text-sm leading-relaxed text-tenue md:grid-cols-3">
          <p>
            El calculo principal usa la <strong className="text-tinta">UF</strong>, que el
            Banco Central reajusta a diario segun la inflacion del mes anterior. Por eso
            los arriendos y los creditos en Chile estan en UF: ya es un indice de precios
            encadenado.
          </p>
          <p>
            Como contraste se calcula lo mismo con el{' '}
            <strong className="text-tinta">IPC encadenado</strong>, que es una fuente
            independiente. Los dos metodos coinciden con menos de 0,1% de diferencia, y
            esa coincidencia es la verificacion de que el numero esta bien.
          </p>
          <p>
            Un detalle que suele salir mal: el IPC se publica como variacion mensual, no
            como indice. Para comparar dos fechas hay que encadenar esas variaciones
            multiplicando, no sumando. Doce meses de 1% dan 12,68% acumulado, no 12%.
          </p>
        </div>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-linea pt-8 text-sm text-tenue">
        <p>
          Datos de{' '}
          <a
            href="https://mindicador.cl"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-4 transition-colors hover:text-tinta"
          >
            mindicador.cl
          </a>
          , actualizados a diario.
        </p>
        <a
          href="https://github.com/Nicolas-Nav/reajuste"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-4 transition-colors hover:text-tinta"
        >
          Codigo en GitHub
        </a>
      </footer>
    </main>
  )
}
