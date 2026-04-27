import os
import re
import sys

def normalize_status(value):
    status = value.strip().lower()
    if status.startswith('aceptado'):
        return 'aceptado'
    return status


def extract_file_status(file_path):
    estado_re = re.compile(r'^-\s*\*\*Estado\*\*\s*:\s*(.+?)\s*$', re.IGNORECASE | re.MULTILINE)
    with open(file_path, 'r', encoding='utf-8') as fh:
        content = fh.read()

    match = estado_re.search(content)
    if not match:
        return None

    return normalize_status(match.group(1))


def verify_adr_consistency():
    base_path = 'docs/adr'

    errors = []
    found_rows = False

    for root, _, files in os.walk(base_path):
        if 'README.md' in files:
            index_path = os.path.join(root, 'README.md')
            with open(index_path, 'r', encoding='utf-8') as fh:
                for raw_line in fh:
                    line = raw_line.strip()
                    # Formato esperado en el índice ADR: | [0001](./archivo.md) | Titulo | Estado |
                    if not line.startswith('| [') or '](' not in line:
                        continue

                    parts = [p.strip() for p in line.split('|')]
                    if len(parts) < 5:
                        continue

                    match = re.search(r'\]\(([^)]+\.md)\)', parts[1])
                    if not match:
                        continue

                    found_rows = True
                    rel_path = match.group(1)
                    index_status_raw = parts[3]
                    index_status = normalize_status(index_status_raw)
                    full_path = os.path.normpath(os.path.join(root, rel_path))

                    # Regla del repo: solo validamos consistencia para ADRs marcados como Aceptado.
                    if index_status != 'aceptado':
                        continue

                    if not os.path.exists(full_path):
                        errors.append(
                            f"Inconsistencia: En {index_path}, {parts[1]} figura como 'Aceptado', pero el archivo {full_path} no existe."
                        )
                        continue

                    file_status = extract_file_status(full_path)
                    if file_status is None:
                        errors.append(
                            f"Inconsistencia: {full_path} no declara '- **Estado**: ...'."
                        )
                        continue

                    if file_status != 'aceptado':
                        errors.append(
                            f"Inconsistencia: {full_path} tiene estado '{file_status}', pero en {index_path} figura como 'Aceptado'."
                        )

    if not found_rows:
        print("Advertencia: No se encontraron filas de índice ADR para validar.")
        return

    if errors:
        for error in errors:
            print(f"::error::{error}")
        sys.exit(1)

    print("Exito: Validacion de indices ADR completada sin inconsistencias.")

if __name__ == "__main__":
    verify_adr_consistency()