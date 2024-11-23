const readline = require("readline");
const crypto = require("crypto");
const Table = require("cli-table3");

class FairNumber {
  static proof(range) {
    const number = Math.floor(Math.random() * range);
    const key = crypto.randomBytes(32).toString("hex");
    const hmac = crypto
      .createHmac("sha256", key)
      .update(number.toString())
      .digest("hex");
    return { number, key, hmac };
  }
}
class Dice {
  constructor(values) {
    this.values = values;
  }
  countWins(otherDice) {
    return this.values.reduce(
      (acc, value) =>
        acc +
        otherDice.values.filter((otherValue) => value > otherValue).length,
      0
    );
  }
  winProb(otherDice) {
    const totalOutcomes = this.values.length * otherDice.values.length;
    return this.countWins(otherDice) / totalOutcomes;
  }
}
class ProbCalc {
  static probTable(diceOptions) {
    return diceOptions.map((diceA) =>
      diceOptions.map((diceB) => diceA.winProb(diceB).toFixed(4))
    );
  }
}
class DiceGame {
  constructor(diceOptions) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.diceOptions = diceOptions.map((values) => new Dice(values));
    this.remainingDice = [...this.diceOptions];
    this.playerDice = null;
    this.computerDice = null;
  }
  start() {
    console.log(`Welcome to the Dice Game!`);
    console.log(`You and I will each select a dice, and we will compete.`);
    this.firstMove();
  }
  firstMove() {
    const proof = FairNumber.proof(2);
    console.log(`Let's determine who makes the first move.`);
    console.log(
      `I selected a random value in the range 0..1 (HMAC=${proof.hmac}).`
    );
    this.rl.question(
      `Try to guess my selection.\n0 - 0\n1 - 1\nX - exit\n? - help\nYour selection: `,
      (answer) => {
        if (answer.toLowerCase() === "x") return this.exitGame();
        if (answer === "?") return this.showHelp(this.firstMove.bind(this));

        const guess = parseInt(answer, 10);
        if (isNaN(guess) || guess < 0 || guess > 1) {
          console.log("Invalid selection.");
          return this.firstMove();
        }

        const mySelection = proof.number;
        console.log(`My selection: ${mySelection} (KEY=${proof.key}).`);
        guess === mySelection ? this.playerSelectDice() : this.compDice();
      }
    );
  }
  compDice() {
    const compIndex = Math.floor(Math.random() * this.remainingDice.length);
    this.computerDice = this.remainingDice.splice(compIndex, 1)[0];
    console.log(
      `I choose the dice: ${JSON.stringify(this.computerDice.values)}.`
    );
    this.playerSelectDice();
  }
  playerSelectDice() {
    console.log(`Choose your dice:`);
    this.remainingDice.forEach((dice, index) =>
      console.log(`${index} - ${JSON.stringify(dice.values)}`)
    );
    this.rl.question("Your selection: ", (answer) => {
      const selection = parseInt(answer, 10);
      if (
        isNaN(selection) ||
        selection < 0 ||
        selection >= this.remainingDice.length
      ) {
        console.log("Invalid selection.");
        return this.playerSelectDice();
      }

      this.playerDice = this.remainingDice.splice(selection, 1)[0];
      console.log(
        `You chose the dice: ${JSON.stringify(this.playerDice.values)}.`
      );
      this.computerThrow();
    });
  }
  computerThrow() {
    if (!this.computerDice) {
      const compIndex = Math.floor(Math.random() * this.remainingDice.length);
      this.computerDice = this.remainingDice.splice(compIndex, 1)[0];
      console.log(
        `I chose the dice: ${JSON.stringify(this.computerDice.values)}.`
      );
    }
    this.throwDice(this.computerDice, (compThrow) => {
      console.log(`My throw is ${compThrow}.`);
      this.playerThrow(compThrow);
    });
  }
  playerThrow(compThrow) {
    this.throwDice(this.playerDice, (playerThrow) => {
      console.log(`Your throw is ${playerThrow}.`);
      if (playerThrow > compThrow)
        console.log(`You win (${playerThrow} > ${compThrow})!`);
      else if (playerThrow === compThrow)
        console.log(`Tie (${compThrow} = ${playerThrow})!`);
      else console.log(`I win (${compThrow} > ${playerThrow})!`);
      this.rl.close();
    });
  }
  throwDice(dice, callback) {
    const throwProof = FairNumber.proof(6);
    console.log(
      `I selected a random value in the range 0..5 (HMAC=${throwProof.hmac}).`
    );
    this.rl.question(
      "Add your number modulo 6:\n0 - 0\n1 - 1\n2 - 2\n3 - 3\n4 - 4\n5 - 5\nX - exit\n? - help\nYour selection: ",
      (answer) => {
        if (answer.toLowerCase() === "x") return this.exitGame();
        if (answer === "?")
          return this.showHelp(() => this.throwDice(dice, callback));

        const userNumber = parseInt(answer, 10);
        if (isNaN(userNumber) || userNumber < 0 || userNumber > 5) {
          console.log("Invalid selection.");
          return this.throwDice(dice, callback);
        }

        const result = (throwProof.number + userNumber) % dice.values.length;
        console.log(
          `My number is ${throwProof.number} (KEY=${throwProof.key}).`
        );
        console.log(
          `Result: (${throwProof.number} + ${userNumber}) mod ${dice.values.length} = ${result}.`
        );
        callback(dice.values[result]);
      }
    );
  }
  showHelp(callback) {
    console.log(`
      Help:
      - Guess the random number correctly to decide who moves first.
      - Each player selects a dice to compete.
      - Higher dice values win rounds.

      Probability of the win for the user:
    `);

    const table = ProbCalc.probTable(this.diceOptions);
    const cliTable = new Table({
      head: [
        "User dice v",
        ...this.diceOptions.map((dice) => dice.values.join(",")),
      ],
      style: { head: ["cyan"], border: [] },
    });
    table.forEach((row, i) => {
      const rowData = [this.diceOptions[i].values.join(",")];
      row.forEach((value, j) => {
        rowData.push(i === j ? `- (${value})` : value);
      });
      cliTable.push(rowData);
    });
    console.log(cliTable.toString());
    callback();
  }

  exitGame() {
    console.log("Exiting...");
    this.rl.close();
  }
}
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error(
    "You must provide at least 3 dice configurations to play the game."
  );
  process.exit(1);
}
const diceOptions = args.map((arg, index) => {
  const dice = arg.split(",").map(Number);
  if (dice.some(isNaN)) {
    console.error(
      `Dice ${
        index + 1
      } contains a non-integer value. Ensure all dice values are integers.`
    );
    process.exit(1);
  }
  if (dice.length < 1) {
    console.error(
      `Dice ${index + 1} has no sides. Each dice must have at least one value.`
    );
    process.exit(1);
  }
  return dice;
});

const game = new DiceGame(diceOptions);
game.start();
