import Npyjs from "npyjs"; // "./npyjs";
import npyFile from "./10-float32.npy";
export default function(callback) {
  const n = new Npyjs();
  n.load(npyFile, callback);
}
