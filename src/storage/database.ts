/** Future local persistence boundary. Repositories will use IndexedDB here. */
export interface LocalDatabase {
  readonly name: "sport-nutrition";
  readonly version: 1;
}
export const localDatabase: LocalDatabase = {
  name: "sport-nutrition",
  version: 1,
};
