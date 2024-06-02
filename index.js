const fs = require("fs");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");
const fse = require("fs-extra");
const prompt = require("prompt-sync")();

const CONFIG_PATH = path.join(__dirname, "config.json");

const wowVersions = { Retail: { directory: "_retail_" }, Classic: { directory: "_classic_" } };

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
}

async function main() {
    try {
        const wowPath = await getWowPath();

        const latestVersionData = await getLatestVersionData();
        console.log(`Última versión disponible de ElvUI: ${latestVersionData.version}`);

        Object.keys(wowVersions).forEach(async (version) => {
            const addonsPath = path.join(wowPath, `${wowVersions[version].directory}`, "Interface", "AddOns");
            const tocPath = path.join(addonsPath, "ElvUI", "ElvUI_Mainline.toc");

            const installedVersion = getInstalledVersion(tocPath);
            console.log(`Versión instalada de ElvUI (${version}): ${installedVersion || "No instalado"}`);

            if (!installedVersion) return;
            if (installedVersion < latestVersionData.version) {
                console.log(`Actualizando ElvUI (${version})...`);
                await updateElvUI(addonsPath, latestVersionData);
                console.log(`ElvUI (${version}) se ha actualizado correctamente.`);
            } else {
                console.log(`ElvUI (${version}) está actualizado.`);
            }
        });
    } catch (error) {
        console.error("Ocurrió un error:", error);
    }
}

main();
