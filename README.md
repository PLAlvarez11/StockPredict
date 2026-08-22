# StockPredict

Sistema web para el control de productos y predicción de stock, pensado para negocios que venden producto por temporadas (oleadas). El proyecto nace como Proyecto de Graduación en Ingeniería en Sistemas de la Universidad Mariano Gálvez.

## ¿Qué resuelve?

Muchos negocios pequeños que venden por temporada (ropa, maquillaje, accesorios, etc.) no tienen forma de saber cuánto producto conviene comprar para la siguiente semana. Terminan comprando "a ojo", lo que provoca dos problemas constantes: quedarse sin stock de lo que sí se vende (perdiendo clientas) o comprar de más de lo que no rota (dinero quieto).

StockPredict ayuda a llevar el control del catálogo de productos, registrar las ventas semana a semana, y con esa información sugiere cuánto comprar para la próxima oleada, usando una fórmula propia basada en el historial de ventas.

## Funcionalidades principales

- Registro e inicio de sesión, con recuperación de contraseña
- Gestión de categorías de producto (con ícono predefinido)
- Gestión de productos y su stock
- Registro de ventas semanales
- Registro de compras a proveedor y ajuste manual de stock
- Predicción de cuánto comprar en la siguiente semana, según el historial de ventas (fórmula PTS: Ponderación, Tendencia y Seguridad)

## Documentación

Toda la documentación técnica del proyecto está en la carpeta [`/docs`](./docs), incluyendo el Documento de Análisis y Diseño (DAD), donde se detalla el alcance, los requisitos, el diseño de base de datos y los mockups de las pantallas.

- [DAD - Documento de Análisis y Diseño](./docs/StockPredict.md)
- [Mockups de las pantallas](./assets/mockups)

## Estructura del repositorio
