import { analyzePCM } from "./analysis.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ features: analyzePCM(data.pcm) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
