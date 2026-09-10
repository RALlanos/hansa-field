"use client";
import { useEffect, useState } from "react";
import {
  segmentationApi,
  type Scheme,
  type Segment,
  type Page,
} from "./contracts";
type Membership = {
  id: string;
  recordId: string | null;
  projectRecordId: string | null;
  segmentId: string;
  segmentName: string;
};
type Access = {
  id: string;
  principalType: string;
  principalId: string;
  permission: string;
  includeDescendants: boolean;
};
export function SegmentRelations({
  scheme,
  segment,
}: {
  scheme: Scheme;
  segment: Segment;
}) {
  const [members, setMembers] = useState<Page<Membership>>({
      items: [],
      nextCursor: null,
    }),
    [access, setAccess] = useState<Access[]>([]),
    [entity, setEntity] = useState(""),
    [descendants, setDescendants] = useState(false),
    [principal, setPrincipal] = useState(""),
    [principalType, setPrincipalType] = useState("user"),
    [permission, setPermission] = useState("view"),
    [include, setInclude] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [cursor, setCursor] = useState("");
  useEffect(() => {
    let live = true;
    void Promise.all([
      segmentationApi<Page<Membership>>(
        `/segments/${segment.id}/memberships?includeDescendants=${descendants}${cursor ? `&cursor=${cursor}` : ""}`,
      ),
      segmentationApi<Access[]>(`/segments/${segment.id}/access`),
    ])
      .then(([m, a]) => {
        if (live) {
          setMembers(m);
          setAccess(a);
        }
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [segment.id, descendants, cursor, revision]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setRevision((r) => r + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h3>Registros en “{segment.name}”</h3>
      {error && (
        <p role="alert" className="seg-error">
          {error}
        </p>
      )}
      <p>
        {scheme.appId
          ? "Asocia Records de esta App a esta zona."
          : "Asocia Project Records de este Proyecto a esta zona."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await segmentationApi(
              `/segments/${segment.id}/memberships`,
              scheme.appId ? { recordId: entity } : { projectRecordId: entity },
            );
            setEntity("");
          });
        }}
      >
        <label>
          {scheme.appId ? "ID del Record" : "ID del registro del Proyecto"}
          <input
            required
            value={entity}
            onChange={(e) => setEntity(e.target.value.trim())}
          />
        </label>
        <button disabled={busy || segment.status !== "active"}>Asignar</button>
      </form>
      <label className="seg-check">
        <input
          type="checkbox"
          checked={descendants}
          onChange={(e) => {
            setDescendants(e.target.checked);
            setCursor("");
          }}
        />
        Incluir zonas internas
      </label>
      {members.items.map((m) => (
        <div className="seg-row" key={m.id}>
          <span>
            {m.recordId ?? m.projectRecordId}
            <small>{m.segmentName}</small>
          </span>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await segmentationApi(
                  `/segments/${m.segmentId}/memberships/${m.id}`,
                  {},
                  "DELETE",
                );
              })
            }
          >
            Quitar de esta zona
          </button>
        </div>
      ))}
      {!members.items.length && <p>Sin asignaciones.</p>}
      <button disabled={!cursor} onClick={() => setCursor("")}>
        Inicio
      </button>
      <button
        disabled={!members.nextCursor}
        onClick={() => setCursor(members.nextCursor ?? "")}
      >
        Más asignaciones
      </button>
      <h3>Permisos de la estructura</h3>
      <p>
        Se guardan las reglas para usuarios o roles. Todavía no sustituyen al
        sistema de autenticación ni filtran el mapa.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await segmentationApi(`/segments/${segment.id}/access`, {
              principalType,
              principalId: principal,
              permission,
              includeDescendants: include,
            });
            setPrincipal("");
          });
        }}
      >
        <label>
          Principal
          <select
            value={principalType}
            onChange={(e) => setPrincipalType(e.target.value)}
          >
            <option value="user">Usuario</option>
            <option value="role">Rol</option>
          </select>
        </label>
        <label>
          ID del usuario o rol
          <input
            required
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </label>
        <label>
          Permiso
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          >
            <option value="view">Ver</option>
            <option value="edit">Editar</option>
            <option value="manage">Administrar</option>
          </select>
        </label>
        <label className="seg-check">
          <input
            type="checkbox"
            checked={include}
            onChange={(e) => setInclude(e.target.checked)}
          />
          Incluir zonas internas
        </label>
        <button disabled={busy}>Guardar permiso</button>
      </form>
      {access.map((a) => (
        <div className="seg-row" key={a.id}>
          <span>
            {a.principalType}: {a.principalId} · {a.permission}{" "}
            {a.includeDescendants ? "+ zonas internas" : ""}
          </span>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await segmentationApi(
                  `/segments/${segment.id}/access/${a.id}`,
                  {},
                  "DELETE",
                );
              })
            }
          >
            Revocar
          </button>
        </div>
      ))}
    </section>
  );
}
