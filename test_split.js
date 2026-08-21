const P = 5.5; // 5 hours 30 mins
const S = 3.25; // 3 hours 15 mins
const total = P + S;
const split = Math.round((P / total) * 100);
console.log(total, split);
