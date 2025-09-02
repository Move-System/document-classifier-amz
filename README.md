# 📄 Document Classifier - Classificador de Documentos Legislativos

## 📌 Sobre o Projeto
Este projeto é um **microserviço em Node.js** para classificação automática de **documentos legislativos municipais**.  
O classificador recebe o texto de um documento (ex.: Requerimento, Indicação, Ofício, Lei etc.) e retorna o tipo mais provável com base em **exemplos representativos** e embeddings semânticos.

O objetivo é **automatizar o fluxo de catalogação** de documentos no sistema GED, reduzindo erros manuais e agilizando o processo.

---

## ⚙️ Funcionalidades
- Recebe o texto extraído de documentos e classifica automaticamente o tipo.
- Usa **OpenAI embeddings** para comparar similaridade com exemplos reais.
- Possui um arquivo `examples.json` para treinar o classificador sem precisar alterar o código.
- Retorna o tipo mais provável e uma métrica de confiança.
- Fácil integração via API REST.

---

## 🏗️ Tecnologias Utilizadas
- [Node.js](https://nodejs.org/) (ESM)
- [Express](https://expressjs.com/)
- [OpenAI API](https://platform.openai.com/)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [cors](https://www.npmjs.com/package/cors)
- [nodemon](https://www.npmjs.com/package/nodemon)
- [@dqbd/tiktoken](https://www.npmjs.com/package/@dqbd/tiktoken)
