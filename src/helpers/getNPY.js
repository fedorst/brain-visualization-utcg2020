import npyjs from "npyjs";

export default function() {
  // eslint-disable-next-line new-cap
  const n = new npyjs();

  n.load( "10-float32.npy").then((res) => console.log("test", res));
}


