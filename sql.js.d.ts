declare module 'sql.js' {
  interface SqlJsStatic {
    Database: typeof Database;
  }

  class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  function initSqlJs(config?: any): Promise<SqlJsStatic>;
  export default initSqlJs;
  export { Database, SqlJsStatic, QueryExecResult };
}
