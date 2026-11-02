using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestsAndGear : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "fiction",
                table: "shelf_entries",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "fiction",
                table: "books",
                type: "boolean",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "gear",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    earned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gear", x => new { x.user_id, x.item });
                    table.ForeignKey(
                        name: "fk_gear_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gear");

            migrationBuilder.DropColumn(
                name: "fiction",
                table: "shelf_entries");

            migrationBuilder.DropColumn(
                name: "fiction",
                table: "books");
        }
    }
}
