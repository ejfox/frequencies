const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { stringify } = require("csv-stringify");

// Headers for CHIRP-compatible CSV
const chirpHeaders = [
  "Location",
  "Name",
  "Frequency",
  "Duplex",
  "Offset",
  "Tone",
  "rToneFreq",
  "cToneFreq",
  "DtcsCode",
  "DtcsPolarity",
  "Mode",
  "TStep",
  "Skip",
  "Comment",
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

// Apply substitutions to shorten names
function applySubstitutions(name) {
  Object.keys(substitutions).forEach((key) => {
    const regex = new RegExp(key, "gi");
    name = name.replace(regex, substitutions[key]);
  });
  return name;
}

// Generate acronyms from the first letters of words
function createAcronym(name) {
  return name
    .split(/\s+/) // Split by spaces
    .map((word) => word.charAt(0).toUpperCase()) // Take the first letter of each word
    .join(""); // Combine letters into an acronym
}

// Shorten the name for CHIRP, ensuring ≤ 10 characters and adding "!" for listen-only
function shortenName(name, notes) {
  let shortened = name;

  // Step 1: Skip modification if already ≤ 10 characters
  if (shortened.length > 10) {
    // Step 2: Apply substitutions
    shortened = applySubstitutions(name);

    // Step 3: Generate acronym if still too long
    if (shortened.length > 10) {
      shortened = createAcronym(shortened);
    }

    // Step 4: Truncate to 10 characters
    shortened = shortened.slice(0, 10);
  }

  // Step 5: Add "!" if listen-only channel
  if (notes.toLowerCase().includes("listen only")) {
    shortened = `!${shortened}`;
  }

  return shortened;
}

// File paths
const inputFilePath = path.resolve("frequencies.csv"); // Input file
const outputFilePath = path.resolve("chirp_formatted.csv"); // Output file

// Reformat input data for CHIRP
async function reformatForCHIRP() {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputFilePath),
    output: process.stdout,
    terminal: false,
  });

  const outputRows = [];
  let lineCount = 0;
  let memorySlot = 1;

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // Skip input header row

    const fields = line.split(",");
    const [
      region, // Region (ignored in CHIRP)
      location, // Location (ignored)
      name, // Name
      frequency, // Frequency
      duplex, // Duplex
      offset, // Offset
      tone, // Tone
      mode, // Mode
      type, // Type (ignored)
      tag, // Tag (ignored)
      notes, // Notes
    ] = fields.map((f) => f.trim()); // Trim whitespace

    const shortenedName = shortenName(name, notes);

    // Map fields to CHIRP-compatible format
    const chirpRow = {
      Location: memorySlot,
      Name: shortenedName,
      Frequency: frequency || "",
      Duplex: duplex.toLowerCase() === "simplex" ? "off" : duplex === "+" ? "+" : "-",
      Offset: offset || "0.000",
      Tone:
        tone.toUpperCase() === "CTCSS"
          ? "Tone"
          : tone.toUpperCase() === "TSQL"
          ? "TSQL"
          : "None",
      rToneFreq:
        tone.toUpperCase() === "CTCSS" || tone.toUpperCase() === "TSQL" ? fields[6] : "",
      cToneFreq: tone.toUpperCase() === "TSQL" ? fields[6] : "",
      DtcsCode: "",
      DtcsPolarity: "",
      Mode: mode.toUpperCase() === "FM" ? "FM" : "NFM",
      TStep: "5.00", // Default step size
      Skip: "",
      Comment: notes || "",
    };

    // Add row to output
    outputRows.push(chirpRow);
    memorySlot++;
  }

  // Write output file using CSV stringify
  stringify(outputRows, { header: true, columns: chirpHeaders }, (err, output) => {
    if (err) {
      console.error("Error writing CSV:", err);
      return;
    }
    fs.writeFileSync(outputFilePath, output);
    console.log(`Reformatted data saved to ${outputFilePath}`);
  });
}

// Run the formatter
reformatForCHIRP();
