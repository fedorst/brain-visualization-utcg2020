import Npyjs from "npyjs"; // "./npyjs";
export default function(file) {
  const n = new Npyjs();
  return new Promise(((resolve, reject) => {
    n.load(file, (res) => resolve(res), null, reject);
  }));
  // n.load(file, ());
}
