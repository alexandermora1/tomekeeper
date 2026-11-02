using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "bio",
                table: "users",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "friends_visible_to",
                table: "users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Friends");

            migrationBuilder.AddColumn<string>(
                name: "handle",
                table: "users",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "progress_visible_to",
                table: "users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Friends");

            migrationBuilder.AddColumn<string>(
                name: "reading_visible_to",
                table: "users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Friends");

            migrationBuilder.AddColumn<string>(
                name: "reviews_visible_to",
                table: "users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Friends");

            migrationBuilder.CreateIndex(
                name: "ix_users_handle",
                table: "users",
                column: "handle",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_users_handle",
                table: "users");

            migrationBuilder.DropColumn(
                name: "bio",
                table: "users");

            migrationBuilder.DropColumn(
                name: "friends_visible_to",
                table: "users");

            migrationBuilder.DropColumn(
                name: "handle",
                table: "users");

            migrationBuilder.DropColumn(
                name: "progress_visible_to",
                table: "users");

            migrationBuilder.DropColumn(
                name: "reading_visible_to",
                table: "users");

            migrationBuilder.DropColumn(
                name: "reviews_visible_to",
                table: "users");
        }
    }
}
