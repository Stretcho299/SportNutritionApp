#!/usr/bin/env python3
"""Prototype isolé de recherche locale dans la table Ciqual 2020.

Télécharge l'archive officielle dans un répertoire temporaire, lit uniquement
les champs nécessaires au MVP et recherche dix aliments génériques. Aucun
fichier de données n'est écrit dans le dépôt.

Exécution : python3 scripts/ciqual_local_spike.py
"""

from __future__ import annotations

import argparse
import io
import re
import shutil
import tempfile
import time
import unicodedata
import urllib.request
import xml.etree.ElementTree as element_tree
import zipfile
from pathlib import Path


ARCHIVE_URL = (
    "https://ciqual.anses.fr/cms/sites/default/files/inline-files/"
    "XML_2020_07_07.zip"
)
FOOD_FILE = "alim_2020_07_07.xml"
COMPOSITION_FILE = "compo_2020_07_07.xml"
NUTRIENTS = {
    "328": ("calories", "kcal"),
    "25000": ("protéines", "g"),
    "31000": ("glucides", "g"),
    "40000": ("lipides", "g"),
}
VALUE_PATTERN = re.compile(r"^\d+(?:,\d+)?$")
QUERIES = ["poulet", "riz", "banane", "pomme", "œuf", "saumon", "pâtes", "avoine", "lait", "yaourt"]


def text(element: element_tree.Element, name: str) -> str:
    return (element.findtext(name) or "").strip()


def normalized(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold().replace("œ", "oe").replace("æ", "ae"))
    return "".join(character for character in decomposed if not unicodedata.combining(character)).casefold()


def is_numeric_value(value: str) -> bool:
    return bool(VALUE_PATTERN.fullmatch(value))


def parseable_xml(xml_path: Path) -> io.StringIO:
    """Répare les chevrons littéraux du XML Ciqual avant le parseur strict.

    Le fichier 2020 contient notamment la chaîne ``(<1° alc.)`` sans
    échappement. Les balises XML restent inchangées ; seul un ``<`` qui ne
    commence pas une balise est converti en ``&lt;`` en mémoire.
    """
    source = xml_path.read_bytes().decode("cp1252")
    source = re.sub(r"<\?xml[^>]*\?>", "", source, count=1)
    source = re.sub(r"&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]+;)", "&amp;", source)
    repaired = re.sub(r"<(?!/?[A-Za-z_][A-Za-z0-9_.:-]*(?:\s|/?>))", "&lt;", source)
    return io.StringIO(repaired)


def parse_foods(xml_path: Path) -> dict[str, str]:
    foods: dict[str, str] = {}
    for _, element in element_tree.iterparse(parseable_xml(xml_path), events=("end",)):
        if element.tag == "ALIM":
            code = text(element, "alim_code")
            name = text(element, "alim_nom_fr")
            if code and name:
                foods[code] = name
            element.clear()
    return foods


def parse_macros(xml_path: Path) -> dict[str, dict[str, str]]:
    macros: dict[str, dict[str, str]] = {}
    for _, element in element_tree.iterparse(parseable_xml(xml_path), events=("end",)):
        if element.tag == "COMPO":
            nutrient_code = text(element, "const_code")
            value = text(element, "teneur")
            if nutrient_code in NUTRIENTS and is_numeric_value(value):
                food_code = text(element, "alim_code")
                macros.setdefault(food_code, {})[nutrient_code] = value
            element.clear()
    return macros


def display_result(code: str, name: str, macros: dict[str, str]) -> str:
    values = []
    for nutrient_code, (label, unit) in NUTRIENTS.items():
        value = macros.get(nutrient_code, "non renseigné")
        values.append(f"{label} : {value}{' ' + unit if value != 'non renseigné' else ''}")
    return f"  - {name} (Ciqual {code})\n    " + ", ".join(values) + " / 100 g de partie comestible"


def download_archive(destination: Path) -> None:
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "SportNutritionApp-spike/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Évalue la recherche locale dans Ciqual 2020.")
    parser.add_argument("--archive", type=Path, help="Archive ZIP Ciqual déjà téléchargée ; évite un nouvel accès réseau.")
    parser.add_argument("--limit", type=int, default=3, help="Nombre maximal de résultats affichés par recherche (défaut : 3).")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="ciqual-local-spike-") as temporary_directory:
        temporary_path = Path(temporary_directory)
        archive = args.archive or temporary_path / "ciqual.zip"
        if not args.archive:
            print(f"Téléchargement : {ARCHIVE_URL}")
            download_started = time.perf_counter()
            download_archive(archive)
            print(f"Archive téléchargée : {archive.stat().st_size / 1_000_000:.1f} Mo en {time.perf_counter() - download_started:.2f} s")

        if not archive.is_file():
            raise SystemExit(f"Archive introuvable : {archive}")

        extraction_directory = temporary_path / "ciqual"
        with zipfile.ZipFile(archive) as zipped:
            zipped.extract(FOOD_FILE, extraction_directory)
            zipped.extract(COMPOSITION_FILE, extraction_directory)

        load_started = time.perf_counter()
        foods = parse_foods(extraction_directory / FOOD_FILE)
        macros = parse_macros(extraction_directory / COMPOSITION_FILE)
        load_duration = time.perf_counter() - load_started
        complete_foods = sum(all(nutrient in values for nutrient in NUTRIENTS) for values in macros.values())
        print(f"Index chargé : {len(foods)} aliments, {complete_foods} avec les 4 macros ; {load_duration:.2f} s")
        print("Base nutritionnelle : 100 g de partie comestible (Ciqual)\n")

        query_started = time.perf_counter()
        missing_queries: list[str] = []
        for query in QUERIES:
            matches = [
                (code, name) for code, name in foods.items()
                if normalized(query) in normalized(name)
            ]
            complete_matches = [(code, name) for code, name in matches if all(nutrient in macros.get(code, {}) for nutrient in NUTRIENTS)]
            complete_matches.sort(key=lambda match: (not normalized(match[1]).startswith(normalized(query)), len(match[1])))
            print(f"Recherche : {query} — {len(matches)} résultat(s), {len(complete_matches)} complet(s)")
            for code, name in complete_matches[:args.limit]:
                print(display_result(code, name, macros[code]))
            if not complete_matches:
                missing_queries.append(query)
        query_duration = time.perf_counter() - query_started
        print(f"\nDix recherches locales : {query_duration * 1_000:.1f} ms")

        if missing_queries:
            print("Aucun résultat complet pour : " + ", ".join(missing_queries))
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
