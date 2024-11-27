const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Headers for CHIRP
const chirpHeaders = [
  "Location", "Name", "Frequency", "Duplex", "Offset", "Tone", "rToneFreq", "cToneFreq",
  "DtcsCode", "DtcsPolarity", "Mode", "TStep", "Skip", "Comment"
];

// Substitution dictionary tailored to your spreadsheet
const substitutions = {
  "Hudson Valley": "HudVal",
  "Orange County": "OrngCo",
  "New York": "NY",
  "Beacon": "Beacn",
  "Cornwall": "Cornw",
  "Dispatch": "Disp",
  "Repeater": "Rpt",
  "Fireground": "FG",
  "Command": "Cmd",
  "Emergency": "Emerg",
  "Operations": "Ops",
  "Tactical": "Tac",
  "Department": "Dept",
  "Public Safety": "PS",
  "Paging": "Pgng",
  "Simplex": "Smplx",
  "Highway": "Hwy",
};

// Function to apply substitutions
function applySubstitutions(name) {
  Object.keys(substitutions).forEach((key) => {
    const regex = new RegExp(key, "gi");
    name = name.replace(regex, substitutions[key]);
  });
  return name;
}

// Function to create acronyms from remaining words
function createAcronym(name) {
  return name
    .split(/\s+/) // Split by spaces
    .map(word => word.charAt(0).toUpperCase()) // Take the first letter of each word
    .join(""); // Combine letters into an acronym
}

// Function to shorten the name for CHIRP
function shortenName(name, comment = "") {
  if (name.length <= 10) {
    return comment.includes("LISTEN ONLY") ? `!${name}` : name;
  }

  let shortened = applySubstitutions(name);
  if (shortened.length > 10) {
    shortened = createAcronym(shortened);
  }
  if (comment.includes("LISTEN ONLY")) {
    shortened = `!${shortened}`;
  }
  return shortened.slice(0, 8); // Truncate to 8 characters for CHIRP
}

// Function to validate and normalize CHIRP fields
function validateChirpRow(row) {
  const {
    Location, Name, Frequency, Duplex, Offset, Tone, rToneFreq, cToneFreq, DtcsCode, DtcsPolarity,
    Mode, TStep, Skip, Comment
  } = row;

  const toneEmpty = !Tone || Tone.toLowerCase() === "none";

  return {
    Location: parseInt(Location, 10) || 0,
    Name: Name.slice(0, 10),
    Frequency: parseFloat(Frequency).toFixed(6) || "",
    Duplex: Duplex.toLowerCase() === "simplex" ? "off" : Duplex === "+" ? "+" : "-",
    Offset: parseFloat(Offset).toFixed(3) || "0.000",
    Tone: ["Tone", "TSQL", "DTCS", "Cross"].includes(Tone) ? Tone : "",
    rToneFreq: toneEmpty ? "" : parseFloat(rToneFreq).toFixed(1) || "",
    cToneFreq: toneEmpty ? "" : parseFloat(cToneFreq).toFixed(1) || "",
    DtcsCode: "",
    DtcsPolarity: "",
    Mode: Mode.toUpperCase() === "FM" ? "FM" : "NFM",
    TStep: "5.00",
    Skip: Skip || "",
    Comment: Comment.trim(),
  };
}

const inputFilePath = path.resolve("frequencies.csv");
const outputFilePath = path.resolve("chirp_formatted.csv");

async function reformatForCHIRP() {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputFilePath),
    output: process.stdout,
    terminal: false,
  });

  const outputRows = [chirpHeaders.join(",")];
  let lineCount = 0;
  let memorySlot = 1;

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;

    const fields = line.split(",");
    const [
      region, location, name, frequency, duplex, offset, tone, mode, type, tag, notes
    ] = fields;

    const shortenedName = shortenName(name, notes);

    const chirpRow = validateChirpRow({
      Location: memorySlot,
      Name: shortenedName,
      Frequency: frequency,
      Duplex: duplex,
      Offset: offset,
      Tone: tone,
      rToneFreq: tone === "Tone" || tone === "TSQL" ? fields[6] : "",
      cToneFreq: tone === "TSQL" ? fields[6] : "",
      DtcsCode: "",
      DtcsPolarity: "",
      Mode: mode,
      TStep: "5.00",
      Skip: "",
      Comment: notes.trim(),
    });

    outputRows.push(chirpHeaders.map(header => chirpRow[header]).join(","));
    memorySlot++;
  }

  fs.writeFileSync(outputFilePath, outputRows.join("\n"));
  console.log(`Reformatted data saved to ${outputFilePath}`);
}

reformatForCHIRP();
