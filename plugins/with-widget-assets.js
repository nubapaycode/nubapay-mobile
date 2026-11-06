/**
 * Agrega imágenes propias al widget / Live Activity de iOS (target de expo-widgets).
 *
 * El código del widget corre aislado y solo puede mostrar imágenes del catálogo de assets de su
 * propio target (`<Image assetName="NubapayCloud" />`); expo-widgets no trae una opción para
 * sumarlas. Este plugin copia `assets/widgets/*.imageset` a `ios/ExpoWidgetsTarget/Assets.xcassets`
 * y lo agrega a la fase de recursos del target, en cada prebuild (no se edita `ios/` a mano).
 *
 * Va ANTES de "expo-widgets" en app.json: los mods corren en orden inverso al registro, así este
 * corre después de que expo-widgets crea el target.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const TARGET = 'ExpoWidgetsTarget';
const CATALOG = 'Assets.xcassets';
const SOURCE = 'assets/widgets';

function copyCatalog(projectRoot, iosRoot) {
  const src = path.join(projectRoot, SOURCE);
  const dest = path.join(iosRoot, TARGET, CATALOG);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(
    path.join(dest, 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2),
  );
  for (const entry of fs.readdirSync(src)) {
    if (!entry.endsWith('.imageset')) continue;
    fs.cpSync(path.join(src, entry), path.join(dest, entry), { recursive: true });
  }
}

const withCatalogFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      copyCatalog(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

const withCatalogInTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const targetUuid = project.findTargetKey(TARGET);
    if (!targetUuid) return cfg;

    const relPath = `${TARGET}/${CATALOG}`;
    const already = Object.values(project.pbxFileReferenceSection()).some(
      (ref) => typeof ref === 'object' && (ref.path === relPath || ref.path === `"${relPath}"`),
    );
    if (already) return cfg;

    // Grupo del target (lo crea expo-widgets); si no aparece, el grupo principal del proyecto.
    const groupKey =
      project.findPBXGroupKey({ name: TARGET }) ||
      project.findPBXGroupKey({ path: TARGET }) ||
      project.getFirstProject().firstProject.mainGroup;

    const file = project.addFile(CATALOG, groupKey, { lastKnownFileType: 'folder.assetcatalog' });
    if (!file) return cfg;
    // La librería deja estas claves como `undefined` literal en el .pbxproj: se sacan.
    const ref = project.pbxFileReferenceSection()[file.fileRef];
    if (ref) {
      for (const key of ['explicitFileType', 'fileEncoding']) {
        if (ref[key] === undefined || ref[key] === 'undefined') delete ref[key];
      }
    }
    file.uuid = project.generateUuid();
    file.target = targetUuid;
    project.addToPbxBuildFileSection(file);

    // Fase de recursos del propio target del widget (buscada en sus buildPhases: las funciones de
    // la librería que buscan por nombre devuelven la de la app). Si no tiene, se crea.
    const resourcesSection = project.hash.project.objects.PBXResourcesBuildPhase || {};
    const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
    let phase = (nativeTarget?.buildPhases || [])
      .map(({ value }) => resourcesSection[value])
      .find((p) => p && typeof p === 'object');
    if (!phase) {
      const created = project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid);
      phase = created?.buildPhase;
    }
    if (!phase) return cfg;
    phase.files.push({ value: file.uuid, comment: `${CATALOG} in Resources` });
    return cfg;
  });

module.exports = function withWidgetAssets(config) {
  return withCatalogInTarget(withCatalogFiles(config));
};
