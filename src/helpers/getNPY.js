import Npyjs from "npyjs"; // "./npyjs";
import npyFile from "./mni_coordinates.npy";
export default function(callback) {
  const n = new Npyjs();
  n.load(npyFile, callback);
}
