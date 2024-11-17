const fs = require("fs");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");
const fse = require("fs-extra");
const prompt = require("prompt-sync")();

const CONFIG_PATH = path.join(__dirname, "config.json");

const wowVersions = { Retail: { directory: "_retail_" }, Classic: { directory: "_classic_" }, Classic_Era: { directory: "_classic_era_" } };

async function getWowPath() {
    if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
        return config.wowPath;
    } else {
        let wowPath;
        while (true) {
            const defaultPath = "C:\\Program Files\\World of Warcraft";
            wowPath = prompt(`Ingrese la ruta de la carpeta de World of Warcraft (${defaultPath}):`);
            if (!wowPath) wowPath = defaultPath;
            if (fs.existsSync(wowPath)) {
                console.clear();
                break;
            } else {
                console.log("Ruta no válida, intente nuevamente.");
            }
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ wowPath: wowPath }, null, 2));
        return wowPath;
    }
}

function getInstalledVersion(tocPath) {
    if (fs.existsSync(tocPath)) {
        const tocContent = fs.readFileSync(tocPath, "utf8");
        const versionMatch = tocContent.match(/##\s*Version:\s*v?([\d.]+)/i);
        if (versionMatch && versionMatch[1]) {
            return versionMatch[1].trim();
        }
    }
    return null;
}

async function getLatestVersionData() {
    const response = await axios.get("https://api.tukui.org/v1/addon/elvui");
    return response.data;
}

async function updateElvUI(addonsPath, latestVersionData) {
    const elvUIPaths = ["ElvUI", "ElvUI_Libraries", "ElvUI_Options"].map((dir) => path.join(addonsPath, dir));
    try {
        for (const dirPath of elvUIPaths) {
            if (fs.existsSync(dirPath)) {
                fse.removeSync(dirPath);
            }
        }

        const response = await axios({
            method: "GET",
            url: latestVersionData.url,
            responseType: "arraybuffer",
        });

        const zip = new AdmZip(response.data);
        zip.extractAllTo(addonsPath, true);

        return null;
    } catch (error) {
        return error;
    }
}

async function main() {
    try {
        const wowPath = await getWowPath();

        const latestVersionData = await getLatestVersionData();
        console.log(`Última versión disponible de ElvUI: ${latestVersionData.version}\n`);

        const results = {};
        for (const versionName in wowVersions) {
            if (Object.hasOwnProperty.call(wowVersions, versionName)) {
                const addonsPath = path.join(wowPath, `${wowVersions[versionName].directory}`, "Interface", "AddOns");
                const tocPath = path.join(addonsPath, "ElvUI", "ElvUI_Mainline.toc");

                const installedVersion = getInstalledVersion(tocPath);
                let versionMessage = `Versión ${versionName.replace("_", " ")}: ${installedVersion || "No instalado"}.`;

                if (!installedVersion) continue;
                if (installedVersion < latestVersionData.version) {
                    console.log(versionMessage + "  Estado: Actualizando...");
                    results[versionName] = await updateElvUI(addonsPath, latestVersionData);
                } else {
                    console.log(versionMessage + "  Estado: Actualizado.");
                }
            }
        }
        const successes = [];
        const errors = [];
        for (const versionName in results) {
            if (Object.hasOwnProperty.call(results, versionName)) {
                const versionNameFormatted = versionName.replace("_", " ");
                if (!results[versionName]) {
                    successes.push(versionNameFormatted);
                } else {
                    errors.push(`${versionNameFormatted}: ${results[versionName]}`);
                }
            }
        }
        if (successes.length > 0) console.log("\nSe han actualizado correctamente las siguientes versiones: " + successes.join(", ") + ".");
        if (errors.length > 0) console.log("\nHan ocurrido los siguientes errores al actualizar:\n\n" + errors.join("\n\n"));
    } catch (error) {
        console.error("Ocurrió un error:", error);
    }
}

main();
