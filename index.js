const fs = require("fs");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");
const fse = require("fs-extra");
const prompt = require("prompt-sync")();

const CONFIG_PATH = path.join(__dirname, "config.json");

async function getWowPath() {
    if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
        return config.wowPath;
    } else {
        let wowPath;
        while (true) {
            wowPath = prompt("Ingrese la ruta de la carpeta de World of Warcraft: ");
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

async function getLatestVersion() {
    const response = await axios.get("https://api.tukui.org/v1/addon/elvui");
    return response.data;
}

async function updateElvUI(wowPath, latestVersion) {
    const addOnsPath = path.join(wowPath, "_retail_", "Interface", "AddOns");
    const elvUIPaths = ["ElvUI", "ElvUI_Libraries", "ElvUI_Options"].map((dir) => path.join(addOnsPath, dir));

    // Borrar carpetas existentes
    for (const dirPath of elvUIPaths) {
        if (fs.existsSync(dirPath)) {
            fse.removeSync(dirPath);
        }
    }

    // Descargar y descomprimir la última versión
    const response = await axios({
        method: "GET",
        url: latestVersion.url,
        responseType: "arraybuffer",
    });

    const zip = new AdmZip(response.data);
    zip.extractAllTo(addOnsPath, true);
}

async function main() {
    try {
        const wowPath = await getWowPath();
        const tocPath = path.join(wowPath, "_retail_", "Interface", "AddOns", "ElvUI", "ElvUI_Mainline.toc");

        const installedVersion = getInstalledVersion(tocPath);

        if (!installedVersion) {
            console.log("ElvUI no está instalado o el archivo ElvUI_Mainline.toc no se encontró.");
            console.log("Presione cualquier tecla para salir...");
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on("data", process.exit.bind(process, 0));
            return;
        }

        console.log(`Versión instalada de ElvUI: ${installedVersion}`);

        const latestVersion = await getLatestVersion();
        console.log(`Última versión disponible de ElvUI: ${latestVersion.version}`);

        if (installedVersion >= latestVersion.version) {
            console.log("ElvUI está actualizado.");
        } else {
            console.log("Actualizando ElvUI...");
            await updateElvUI(wowPath, latestVersion);
            console.log("ElvUI se ha actualizado correctamente.");
        }
    } catch (error) {
        console.error("Ocurrió un error:", error);
    }
}

main();
