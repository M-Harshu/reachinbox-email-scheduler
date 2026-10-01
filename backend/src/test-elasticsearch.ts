import { elasticClient } from "./elasticsearch";

async function testElasticsearch() {
  try {
    const response = await elasticClient.info();

    console.log("Elasticsearch connection successful ✅");
    console.log(response);

    await elasticClient.close();
  } catch (error) {
    console.error("Elasticsearch connection failed ❌", error);
  }
}

testElasticsearch();